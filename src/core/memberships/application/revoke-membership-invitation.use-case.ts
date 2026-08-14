import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditLog } from '../../audit/application/audit-log';
import { AuthorizationPolicy } from '../../authorization/application/authorization-policy';
import { AuthorizationDeniedError } from '../../authorization/application/authorization-denied.error';
import { Clock } from '../../../shared/application/clock';
import { IdentifierFactory } from '../../../shared/application/identifier-factory';
import { TRANSACTION_MANAGER } from '../../../shared/application/transaction-manager.port';
import type { TransactionManager } from '../../../shared/application/transaction-manager.port';
import { isTransactionWriteConflict } from '../../../shared/application/transaction-write-conflict';
import { MembershipInvitationUnavailableError } from '../domain/membership-invitation.errors';
import { MembershipInvitations } from './membership-invitations';
import { Memberships } from './memberships';

/**
 * Reauthorizes invitation revocation and scopes the target to the actor's
 * trusted workspace inside a transaction. Missing or raced targets are
 * intentionally idempotent; a successful revocation is audited atomically.
 */
@Injectable()
export class RevokeMembershipInvitation {
  private readonly logger = new Logger(RevokeMembershipInvitation.name);

  constructor(
    private readonly memberships: Memberships,
    private readonly invitations: MembershipInvitations,
    private readonly authorization: AuthorizationPolicy,
    private readonly auditLog: AuditLog,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
  ) {}

  /** Revokes a visible invitation without revealing cross-workspace targets. */
  async execute(input: {
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
          if (!actorMembership) {
            throw new AuthorizationDeniedError();
          }

          const invitation = await this.invitations.findActiveById(
            input.workspaceId,
            input.invitationId,
            now,
          );
          if (!invitation) {
            return;
          }
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
        if (attempt === 0 && isTransactionWriteConflict(error)) {
          continue;
        }
        if (error instanceof AuthorizationDeniedError) {
          throw error;
        }
        this.logger.error(
          JSON.stringify({
            event: 'membership.invitation_revoke_failed',
            errorType: error instanceof Error ? error.name : 'UnknownError',
            errorCode: readSafeErrorCode(error),
          }),
        );
        throw new MembershipInvitationUnavailableError();
      }
    }
  }
}

/** Extracts only a safe database-style code for redacted failure logging. */
function readSafeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  return typeof error.code === 'string' ? error.code : undefined;
}
