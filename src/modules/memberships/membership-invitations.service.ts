import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import {
  AuthorizationDeniedError,
  AuthorizationPolicyService,
} from '../authorization/policy/authorization-policy.service';
import {
  IdentityService,
  normalizeIdentityEmail,
} from '../identity/identity.service';
import { UsersService } from '../users/users.service';
import { AppConfig } from '../../config/app-config';
import { Clock } from '../../common/clock';
import { IdentifierFactory } from '../../common/identifier-factory';
import { TRANSACTION_MANAGER } from '../../common/transaction-manager';
import type { TransactionManager } from '../../common/transaction-manager';
import { isTransactionWriteConflict } from '../../common/transaction-write-conflict';
import {
  MembershipInvitationConflictError,
  MembershipInvitationInvalidError,
  MembershipInvitationUnavailableError,
} from './errors/membership-invitation.errors';
import type { InvitableMembershipRole } from './membership-role';
import { MembershipInvitationDeliveryService } from './mail/membership-invitation-delivery.service';
import { OpaqueTokenService } from '../../common/security/opaque-token.service';
import { MembershipInvitationsRepository } from './repositories/membership-invitations.repository';
import { MembershipsRepository } from './repositories/memberships.repository';

/** Invitation response safe for the API; the raw token is deliberately absent. */
export type CreatedMembershipInvitation = Readonly<{
  id: string;
  workspaceId: string;
  normalizedEmail: string;
  role: InvitableMembershipRole;
  expiresAt: Date;
  emailSent: boolean;
}>;

/** Owns membership invitation creation, acceptance, and revocation workflows. */
@Injectable()
export class MembershipInvitationsService {
  private readonly createLogger = new Logger('CreateMembershipInvitation');
  private readonly acceptLogger = new Logger('AcceptMembershipInvitation');
  private readonly revokeLogger = new Logger('RevokeMembershipInvitation');

  constructor(
    private readonly memberships: MembershipsRepository,
    private readonly invitations: MembershipInvitationsRepository,
    private readonly identities: IdentityService,
    private readonly users: UsersService,
    private readonly authorization: AuthorizationPolicyService,
    private readonly auditLog: AuditService,
    private readonly delivery: MembershipInvitationDeliveryService,
    private readonly tokens: OpaqueTokenService,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
    private readonly config: AppConfig,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
  ) {}

  /** Creates or replaces one authorized workspace invitation. */
  async create(input: {
    actorUserId: string;
    workspaceId: string;
    email: string;
    role: InvitableMembershipRole;
  }): Promise<CreatedMembershipInvitation> {
    const normalizedEmail = normalizeIdentityEmail(input.email);
    const token = this.tokens.create();
    const invitationId = this.identifiers.create();
    const expiresAt = new Date(
      this.clock.now().getTime() +
        this.config.membershipInvitationTtlSeconds * 1000,
    );

    try {
      await this.transactions.execute(async () => {
        const now = this.clock.now();
        const actorMembership = await this.memberships.find({
          workspaceId: input.workspaceId,
          userId: input.actorUserId,
        });
        if (
          !actorMembership ||
          !this.authorization.permits(
            actorMembership.role,
            'membership-invitation:create',
          ) ||
          !this.authorization.permits(
            actorMembership.role,
            'membership:read',
          ) ||
          !this.authorization.mayInvite(actorMembership.role, input.role)
        ) {
          throw new AuthorizationDeniedError();
        }
        const activeInvitation = await this.invitations.findActiveForEmail(
          input.workspaceId,
          normalizedEmail,
          now,
        );
        if (
          activeInvitation &&
          !this.authorization.mayInvite(
            actorMembership.role,
            activeInvitation.role,
          )
        ) {
          throw new AuthorizationDeniedError();
        }
        const identity = await this.identities.findByEmail(normalizedEmail);
        const targetUser = identity
          ? await this.users.findByIdentityId(identity.id)
          : null;
        if (
          targetUser &&
          (await this.memberships.find({
            workspaceId: input.workspaceId,
            userId: targetUser.id,
          }))
        ) {
          throw new MembershipInvitationConflictError();
        }
        await this.invitations.retireActive(
          input.workspaceId,
          normalizedEmail,
          now,
        );
        await this.invitations.create({
          id: invitationId,
          workspaceId: input.workspaceId,
          invitedByUserId: input.actorUserId,
          normalizedEmail,
          role: input.role,
          tokenHash: token.hash,
          activeKey: this.tokens.hash(
            `${input.workspaceId}\0${normalizedEmail}`,
          ),
          expiresAt,
        });
        await this.delivery.enqueue({
          workspaceId: input.workspaceId,
          invitationId,
          email: normalizedEmail,
          token: token.raw,
          role: input.role,
          expiresAt,
        });
        await this.auditLog.append({
          id: this.identifiers.create(),
          workspaceId: input.workspaceId,
          actorUserId: input.actorUserId,
          action: 'membership.invitation.created',
          resourceId: invitationId,
        });
      });
    } catch (error) {
      if (
        error instanceof AuthorizationDeniedError ||
        error instanceof MembershipInvitationConflictError
      ) {
        throw error;
      }
      if (isTransactionWriteConflict(error) || isUniqueConflict(error)) {
        throw new MembershipInvitationConflictError();
      }
      this.logFailure(
        this.createLogger,
        'membership.invitation_create_failed',
        error,
      );
      throw new MembershipInvitationUnavailableError();
    }
    const emailSent = await this.delivery.attempt({
      workspaceId: input.workspaceId,
      invitationId,
    });
    return Object.freeze({
      id: invitationId,
      workspaceId: input.workspaceId,
      normalizedEmail,
      role: input.role,
      expiresAt,
      emailSent,
    });
  }

  /** Accepts one email-bound invitation for the trusted actor. */
  async accept(input: { actorUserId: string; token: string }): Promise<void> {
    const tokenHash = this.tokens.hashIfValid(input.token);
    if (!tokenHash) throw new MembershipInvitationInvalidError();

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await this.transactions.execute(async () => {
          const now = this.clock.now();
          const [invitation, user] = await Promise.all([
            this.invitations.findUsableByTokenHash(tokenHash, now),
            this.users.findAuthenticationReferenceById(input.actorUserId),
          ]);
          if (!invitation || !user || user.status !== 'ACTIVE') {
            throw new MembershipInvitationInvalidError();
          }
          const [identity, inviterMembership, existingMembership] =
            await Promise.all([
              this.identities.findById(user.identityId),
              this.memberships.find({
                workspaceId: invitation.workspaceId,
                userId: invitation.invitedByUserId,
              }),
              this.memberships.find({
                workspaceId: invitation.workspaceId,
                userId: input.actorUserId,
              }),
            ]);
          if (
            !identity ||
            identity.normalizedEmail !== invitation.normalizedEmail ||
            !inviterMembership ||
            !this.authorization.permits(
              inviterMembership.role,
              'membership-invitation:create',
            ) ||
            !this.authorization.mayInvite(
              inviterMembership.role,
              invitation.role,
            ) ||
            existingMembership
          ) {
            throw new MembershipInvitationInvalidError();
          }
          if (
            !(await this.invitations.accept(
              invitation.workspaceId,
              invitation.id,
              input.actorUserId,
              now,
            ))
          ) {
            throw new MembershipInvitationInvalidError();
          }
          await this.memberships.createInvited({
            id: this.identifiers.create(),
            workspaceId: invitation.workspaceId,
            userId: input.actorUserId,
            role: invitation.role,
          });
          await this.auditLog.append({
            id: this.identifiers.create(),
            workspaceId: invitation.workspaceId,
            actorUserId: input.actorUserId,
            action: 'membership.invitation.accepted',
            resourceId: invitation.id,
          });
        });
        return;
      } catch (error) {
        if (attempt === 0 && isTransactionWriteConflict(error)) continue;
        if (error instanceof MembershipInvitationInvalidError) throw error;
        if (isUniqueConflict(error))
          throw new MembershipInvitationInvalidError();
        this.logFailure(
          this.acceptLogger,
          'membership.invitation_accept_failed',
          error,
        );
        throw new MembershipInvitationUnavailableError();
      }
    }
  }

  /** Idempotently revokes one invitation visible in the trusted workspace. */
  async revoke(input: {
    actorUserId: string;
    workspaceId: string;
    invitationId: string;
  }): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await this.transactions.execute(async () => {
          const now = this.clock.now();
          const actorMembership = await this.memberships.find({
            workspaceId: input.workspaceId,
            userId: input.actorUserId,
          });
          if (!actorMembership) throw new AuthorizationDeniedError();
          const invitation = await this.invitations.findActiveById(
            input.workspaceId,
            input.invitationId,
            now,
          );
          if (!invitation) return;
          if (
            !this.authorization.permits(
              actorMembership.role,
              'membership-invitation:revoke',
            ) ||
            !this.authorization.mayInvite(actorMembership.role, invitation.role)
          ) {
            throw new AuthorizationDeniedError();
          }
          if (
            !(await this.invitations.revoke(
              input.workspaceId,
              invitation.id,
              now,
            ))
          ) {
            return;
          }
          await this.auditLog.append({
            id: this.identifiers.create(),
            workspaceId: input.workspaceId,
            actorUserId: input.actorUserId,
            action: 'membership.invitation.revoked',
            resourceId: invitation.id,
          });
        });
        return;
      } catch (error) {
        if (attempt === 0 && isTransactionWriteConflict(error)) continue;
        if (error instanceof AuthorizationDeniedError) throw error;
        this.logFailure(
          this.revokeLogger,
          'membership.invitation_revoke_failed',
          error,
        );
        throw new MembershipInvitationUnavailableError();
      }
    }
  }

  private logFailure(logger: Logger, event: string, error: unknown): void {
    logger.error(
      JSON.stringify({
        event,
        errorType: error instanceof Error ? error.name : 'UnknownError',
        errorCode: readSafeErrorCode(error),
      }),
    );
  }
}

/** Recognizes a persistence uniqueness race without exposing adapter details. */
function isUniqueConflict(error: unknown): boolean {
  return readSafeErrorCode(error) === 'P2002';
}

/** Extracts only a string error code that is safe for structured logs. */
function readSafeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error))
    return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}
