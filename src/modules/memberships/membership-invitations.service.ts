import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { Clock } from '../../common/clock';
import { IdentifierFactory } from '../../common/identifier-factory';
import { OpaqueTokenService } from '../../common/security/opaque-token.service';
import { TRANSACTION_MANAGER } from '../../common/transaction-manager';
import type { TransactionManager } from '../../common/transaction-manager';
import { isTransactionWriteConflict } from '../../common/transaction-write-conflict';
import { AuditService } from '../audit/audit.service';
import { AuthorizationDeniedError } from '../authorization/authorization.errors';
import { normalizeUserEmail, UsersService } from '../users/users.service';
import {
  MembershipInvitationConflictError,
  MembershipInvitationInvalidError,
  MembershipInvitationUnavailableError,
} from './errors/membership-invitation.errors';
import { MembershipInvitationDeliveryService } from './mail/membership-invitation-delivery.service';
import { MembershipInvitationsRepository } from './membership-invitations.repository';
import { MembershipsRepository } from './memberships.repository';

/** Safe invitation summary returned after its mail is queued. */
export type CreatedMembershipInvitation = Readonly<{
  id: string;
  workspaceId: string;
  normalizedEmail: string;
  role: 'MEMBER';
  expiresAt: Date;
  emailQueued: true;
}>;

/** Owns single-workspace member invitation creation, acceptance, and revocation. */
@Injectable()
export class MembershipInvitationsService {
  private readonly logger = new Logger(MembershipInvitationsService.name);

  constructor(
    private readonly memberships: MembershipsRepository,
    private readonly invitations: MembershipInvitationsRepository,
    private readonly users: UsersService,
    private readonly audit: AuditService,
    private readonly delivery: MembershipInvitationDeliveryService,
    private readonly tokens: OpaqueTokenService,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
    private readonly config: AppConfig,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
  ) {}

  /** Queues one MEMBER invitation atomically with its token and audit record. */
  async create(input: {
    actorUserId: string;
    workspaceId: string;
    email: string;
  }): Promise<CreatedMembershipInvitation> {
    const normalizedEmail = normalizeUserEmail(input.email);
    const token = this.tokens.create();
    const invitationId = this.identifiers.create();
    const now = this.clock.now();
    const expiresAt = new Date(
      now.getTime() + this.config.membershipInvitationTtlSeconds * 1000,
    );
    try {
      await this.transactions.execute(async () => {
        const actor = await this.memberships.find({
          workspaceId: input.workspaceId,
          userId: input.actorUserId,
        });
        if (actor?.role !== 'OWNER') throw new AuthorizationDeniedError();
        if (
          await this.invitations.findActiveForEmail(
            input.workspaceId,
            normalizedEmail,
            now,
          )
        ) {
          throw new MembershipInvitationConflictError();
        }
        const target = await this.users.findByEmail(normalizedEmail);
        if (
          target &&
          (await this.memberships.find({
            workspaceId: input.workspaceId,
            userId: target.id,
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
          expiresAt,
        });
        await this.audit.append({
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
      this.log('membership.invitation_create_failed', error);
      throw new MembershipInvitationUnavailableError();
    }
    return Object.freeze({
      id: invitationId,
      workspaceId: input.workspaceId,
      normalizedEmail,
      role: 'MEMBER',
      expiresAt,
      emailQueued: true,
    });
  }

  /** Accepts an email-bound invitation without changing the active session. */
  async accept(input: { actorUserId: string; token: string }): Promise<void> {
    const tokenHash = this.tokens.hashIfValid(input.token);
    if (!tokenHash) throw new MembershipInvitationInvalidError();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await this.transactions.execute(async () => {
          const now = this.clock.now();
          const [invitation, user] = await Promise.all([
            this.invitations.findUsableByTokenHash(tokenHash, now),
            this.users.findAccountById(input.actorUserId),
          ]);
          if (
            !invitation ||
            !user ||
            user.status !== 'ACTIVE' ||
            user.normalizedEmail !== invitation.normalizedEmail
          ) {
            throw new MembershipInvitationInvalidError();
          }
          const [inviter, existing] = await Promise.all([
            this.memberships.find({
              workspaceId: invitation.workspaceId,
              userId: invitation.invitedByUserId,
            }),
            this.memberships.find({
              workspaceId: invitation.workspaceId,
              userId: input.actorUserId,
            }),
          ]);
          if (inviter?.role !== 'OWNER' || existing) {
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
          });
          await this.audit.append({
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
        if (
          error instanceof MembershipInvitationInvalidError ||
          isUniqueConflict(error)
        ) {
          throw new MembershipInvitationInvalidError();
        }
        this.log('membership.invitation_accept_failed', error);
        throw new MembershipInvitationUnavailableError();
      }
    }
  }

  /** Idempotently revokes a visible invitation as the permanent owner. */
  async revoke(input: {
    actorUserId: string;
    workspaceId: string;
    invitationId: string;
  }): Promise<void> {
    try {
      await this.transactions.execute(async () => {
        const now = this.clock.now();
        const actor = await this.memberships.find({
          workspaceId: input.workspaceId,
          userId: input.actorUserId,
        });
        if (actor?.role !== 'OWNER') throw new AuthorizationDeniedError();
        const invitation = await this.invitations.findActiveById(
          input.workspaceId,
          input.invitationId,
          now,
        );
        if (!invitation) return;
        if (
          !(await this.invitations.revoke(
            input.workspaceId,
            invitation.id,
            now,
          ))
        ) {
          return;
        }
        await this.audit.append({
          id: this.identifiers.create(),
          workspaceId: input.workspaceId,
          actorUserId: input.actorUserId,
          action: 'membership.invitation.revoked',
          resourceId: invitation.id,
        });
      });
    } catch (error) {
      if (error instanceof AuthorizationDeniedError) throw error;
      this.log('membership.invitation_revoke_failed', error);
      throw new MembershipInvitationUnavailableError();
    }
  }

  private log(event: string, error: unknown): void {
    this.logger.error(
      JSON.stringify({
        event,
        errorType: error instanceof Error ? error.name : 'UnknownError',
        errorCode: readSafeErrorCode(error),
      }),
    );
  }
}

function isUniqueConflict(error: unknown): boolean {
  return readSafeErrorCode(error) === 'P2002';
}

function readSafeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  return typeof error.code === 'string' ? error.code : undefined;
}
