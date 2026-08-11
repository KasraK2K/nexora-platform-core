import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditLog } from '../../audit/application/audit-log';
import { AuthorizationPolicy } from '../../authorization/application/authorization-policy';
import { IdentityLookup } from '../../identity/application/identity-lookup';
import { Users } from '../../users/application/users';
import { Clock } from '../../../shared/application/clock';
import { IdentifierFactory } from '../../../shared/application/identifier-factory';
import { TRANSACTION_MANAGER } from '../../../shared/application/transaction-manager.port';
import type { TransactionManager } from '../../../shared/application/transaction-manager.port';
import { isTransactionWriteConflict } from '../../../shared/application/transaction-write-conflict';
import {
  MembershipInvitationInvalidError,
  MembershipInvitationUnavailableError,
} from '../domain/membership-invitation.errors';
import { MembershipInvitationTokenService } from './membership-invitation-token.service';
import { MembershipInvitations } from './membership-invitations';
import { Memberships } from './memberships';
import { InvitedMembershipsWriter } from './invited-memberships-writer';

@Injectable()
export class AcceptMembershipInvitation {
  private readonly logger = new Logger(AcceptMembershipInvitation.name);

  constructor(
    private readonly memberships: Memberships,
    private readonly membershipWriter: InvitedMembershipsWriter,
    private readonly invitations: MembershipInvitations,
    private readonly users: Users,
    private readonly identities: IdentityLookup,
    private readonly authorization: AuthorizationPolicy,
    private readonly auditLog: AuditLog,
    private readonly tokens: MembershipInvitationTokenService,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
  ) {}

  async execute(input: { actorUserId: string; token: string }): Promise<void> {
    const tokenHash = this.tokens.hashIfValid(input.token);
    if (!tokenHash) {
      throw new MembershipInvitationInvalidError();
    }

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
          await this.membershipWriter.create({
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
        if (attempt === 0 && isWriteConflict(error)) {
          continue;
        }
        if (error instanceof MembershipInvitationInvalidError) {
          throw error;
        }
        if (isUniqueConflict(error)) {
          throw new MembershipInvitationInvalidError();
        }
        this.logFailure(error);
        throw new MembershipInvitationUnavailableError();
      }
    }
  }

  private logFailure(error: unknown): void {
    this.logger.error(
      JSON.stringify({
        event: 'membership.invitation_accept_failed',
        errorType: error instanceof Error ? error.name : 'UnknownError',
        errorCode: readSafeErrorCode(error),
      }),
    );
  }
}

function isWriteConflict(error: unknown): boolean {
  return isTransactionWriteConflict(error);
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
