import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditLog } from '../../audit/application/audit-log';
import { MembershipSessionRevocations } from '../../authentication/application/membership-session-revocations';
import type { RevokedMembershipSession } from '../../authentication/application/membership-session-revocations';
import { AuthorizationPolicy } from '../../authorization/application/authorization-policy';
import { AuthorizationDeniedError } from '../../authorization/application/authorization-denied.error';
import { Clock } from '../../../shared/application/clock';
import { IdentifierFactory } from '../../../shared/application/identifier-factory';
import { TRANSACTION_MANAGER } from '../../../shared/application/transaction-manager.port';
import type { TransactionManager } from '../../../shared/application/transaction-manager.port';
import { isTransactionWriteConflict } from '../../../shared/application/transaction-write-conflict';
import {
  MembershipAdministrationUnavailableError,
  MembershipOwnershipProtectedError,
} from '../domain/membership-administration.errors';
import { MembershipAdministration } from './membership-administration';

/**
 * Soft-removes a lower-role membership after transaction-time authorization.
 * Only sessions for the removed user in this workspace are revoked; Redis cache
 * cleanup occurs best effort after the database transaction commits.
 */
@Injectable()
export class RemoveMembership {
  private readonly logger = new Logger(RemoveMembership.name);

  constructor(
    private readonly memberships: MembershipAdministration,
    @Inject(MembershipSessionRevocations)
    private readonly sessionRevocations: Pick<
      MembershipSessionRevocations,
      'hasActiveContext' | 'revokeActiveForMembership' | 'clearCachesBestEffort'
    >,
    private readonly authorization: AuthorizationPolicy,
    private readonly auditLog: AuditLog,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
  ) {}

  /**
   * Removes a visible non-owner target and audits the change atomically.
   * Missing targets are idempotent, while ownership and permission failures are
   * explicit and concurrent compare-and-set misses are retried once.
   */
  async execute(input: {
    actorUserId: string;
    workspaceId: string;
    membershipId: string;
  }): Promise<void> {
    let revokedSessions: readonly RevokedMembershipSession[] = [];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        revokedSessions = await this.transactions.execute(async () => {
          const now = this.clock.now();
          const [actor, target] = await Promise.all([
            this.memberships.findActiveForUser(
              input.workspaceId,
              input.actorUserId,
            ),
            this.memberships.findActiveById(
              input.workspaceId,
              input.membershipId,
            ),
          ]);
          if (
            !actor ||
            !this.authorization.permits(actor.role, 'membership:remove')
          ) {
            throw new AuthorizationDeniedError();
          }
          if (!target) return [];
          if (target.role === 'OWNER') {
            throw new MembershipOwnershipProtectedError();
          }
          if (!this.authorization.mayRemoveMembership(actor, target)) {
            throw new AuthorizationDeniedError();
          }

          const revoked =
            await this.sessionRevocations.revokeActiveForMembership({
              userId: target.userId,
              workspaceId: input.workspaceId,
              revokedAt: now,
            });
          if (
            !(await this.memberships.remove({
              workspaceId: input.workspaceId,
              membershipId: target.id,
              expectedRole: target.role,
              removedAt: now,
            }))
          ) {
            throw new MembershipWriteConflictError();
          }
          await this.auditLog.append({
            id: this.identifiers.create(),
            workspaceId: input.workspaceId,
            actorUserId: input.actorUserId,
            action: 'membership.removed',
            resourceId: target.id,
          });
          return revoked;
        });
        break;
      } catch (error) {
        if (attempt === 0 && isWriteConflict(error)) continue;
        if (
          error instanceof AuthorizationDeniedError ||
          error instanceof MembershipOwnershipProtectedError
        ) {
          throw error;
        }
        this.logFailure(error);
        throw new MembershipAdministrationUnavailableError();
      }
    }

    await this.sessionRevocations.clearCachesBestEffort(revokedSessions);
  }

  /** Logs safe failure metadata without membership or session identifiers. */
  private logFailure(error: unknown): void {
    this.logger.error(
      JSON.stringify({
        event: 'membership.remove_failed',
        errorType: error instanceof Error ? error.name : 'UnknownError',
        errorCode: readSafeErrorCode(error),
      }),
    );
  }
}

/** Signals a compare-and-set miss so revocation and removal roll back together. */
class MembershipWriteConflictError extends Error {}

/** Recognizes local compare-and-set misses and adapter transaction conflicts. */
function isWriteConflict(error: unknown): boolean {
  return (
    error instanceof MembershipWriteConflictError ||
    isTransactionWriteConflict(error)
  );
}

/** Extracts only a safe database-style code for redacted logging. */
function readSafeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  return typeof error.code === 'string' ? error.code : undefined;
}
