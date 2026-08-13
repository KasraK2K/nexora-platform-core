import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditLog } from '../../audit/application/audit-log';
import { AuthorizationPolicy } from '../../authorization/application/authorization-policy';
import { AuthorizationDeniedError } from '../../authorization/application/authorization-denied.error';
import { AppConfig } from '../../configuration/app-config';
import { IdentityLookup } from '../../identity/application/identity-lookup';
import { normalizeIdentityEmail } from '../../identity/application/identity-lookup';
import { Users } from '../../users/application/users';
import { Clock } from '../../../shared/application/clock';
import { IdentifierFactory } from '../../../shared/application/identifier-factory';
import { TRANSACTION_MANAGER } from '../../../shared/application/transaction-manager.port';
import type { TransactionManager } from '../../../shared/application/transaction-manager.port';
import { isTransactionWriteConflict } from '../../../shared/application/transaction-write-conflict';
import {
  MembershipInvitationConflictError,
  MembershipInvitationUnavailableError,
} from '../domain/membership-invitation.errors';
import type { InvitableMembershipRole } from './membership-role';
import { MembershipInvitationDelivery } from './membership-invitation-delivery';
import { MembershipInvitationTokenService } from './membership-invitation-token.service';
import { MembershipInvitations } from './membership-invitations';
import { Memberships } from './memberships';

export type CreatedMembershipInvitation = Readonly<{
  id: string;
  workspaceId: string;
  normalizedEmail: string;
  role: InvitableMembershipRole;
  expiresAt: Date;
  emailSent: boolean;
}>;

@Injectable()
export class CreateMembershipInvitation {
  private readonly logger = new Logger(CreateMembershipInvitation.name);

  constructor(
    private readonly memberships: Memberships,
    private readonly invitations: MembershipInvitations,
    @Inject(IdentityLookup)
    private readonly identities: Pick<IdentityLookup, 'findByEmail'>,
    @Inject(Users)
    private readonly users: Pick<Users, 'findByIdentityId'>,
    private readonly authorization: AuthorizationPolicy,
    private readonly auditLog: AuditLog,
    @Inject(MembershipInvitationDelivery)
    private readonly delivery: Pick<
      MembershipInvitationDelivery,
      'enqueue' | 'attempt'
    >,
    private readonly tokens: MembershipInvitationTokenService,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
    @Inject(AppConfig)
    private readonly config: Pick<AppConfig, 'membershipInvitationTtlSeconds'>,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
  ) {}

  async execute(input: {
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
          activeKey: this.tokens.createActiveKey(
            input.workspaceId,
            normalizedEmail,
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
      if (isWriteConflict(error) || isUniqueConflict(error)) {
        throw new MembershipInvitationConflictError();
      }
      this.logFailure(error);
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

  private logFailure(error: unknown): void {
    this.logger.error(
      JSON.stringify({
        event: 'membership.invitation_create_failed',
        errorType: error instanceof Error ? error.name : 'UnknownError',
        errorCode: readSafeErrorCode(error),
      }),
    );
  }
}

function readSafeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  return typeof error.code === 'string' ? error.code : undefined;
}

function isWriteConflict(error: unknown): boolean {
  return isTransactionWriteConflict(error);
}

function isUniqueConflict(error: unknown): boolean {
  return readSafeErrorCode(error) === 'P2002';
}
