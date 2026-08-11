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
  MembershipLastWorkspaceProtectedError,
  MembershipOwnershipProtectedError,
} from '../domain/membership-administration.errors';
import { MembershipAdministration } from './membership-administration';

@Injectable()
export class LeaveCurrentWorkspace {
  private readonly logger = new Logger(LeaveCurrentWorkspace.name);

  constructor(
    private readonly memberships: MembershipAdministration,
    private readonly sessionRevocations: MembershipSessionRevocations,
    private readonly authorization: AuthorizationPolicy,
    private readonly auditLog: AuditLog,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
  ) {}

  async execute(input: {
    sessionId: string;
    actorUserId: string;
    workspaceId: string;
  }): Promise<void> {
    let revokedSessions: readonly RevokedMembershipSession[] = [];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        revokedSessions = await this.transactions.execute(async () => {
          const now = this.clock.now();
          const [sessionIsActive, membership] = await Promise.all([
            this.sessionRevocations.hasActiveContext({
              sessionId: input.sessionId,
              userId: input.actorUserId,
              workspaceId: input.workspaceId,
              now,
            }),
            this.memberships.findActiveForUser(
              input.workspaceId,
              input.actorUserId,
            ),
          ]);
          if (
            !sessionIsActive ||
            !membership ||
            !this.authorization.permits(
              membership.role,
              'membership:self:leave',
            )
          ) {
            throw new AuthorizationDeniedError();
          }
          if (membership.role === 'OWNER') {
            throw new MembershipOwnershipProtectedError();
          }
          if (!this.authorization.mayLeaveWorkspace(membership.role)) {
            throw new AuthorizationDeniedError();
          }
          if (
            !(await this.memberships.hasOtherActiveForUser(
              input.actorUserId,
              input.workspaceId,
            ))
          ) {
            throw new MembershipLastWorkspaceProtectedError();
          }

          const revoked =
            await this.sessionRevocations.revokeActiveForMembership({
              userId: input.actorUserId,
              workspaceId: input.workspaceId,
              revokedAt: now,
            });
          if (
            !(await this.memberships.remove({
              workspaceId: input.workspaceId,
              membershipId: membership.id,
              expectedRole: membership.role,
              removedAt: now,
            }))
          ) {
            throw new MembershipWriteConflictError();
          }
          await this.auditLog.append({
            id: this.identifiers.create(),
            workspaceId: input.workspaceId,
            actorUserId: input.actorUserId,
            action: 'membership.left',
            resourceId: membership.id,
          });
          return revoked;
        });
        break;
      } catch (error) {
        if (attempt === 0 && isWriteConflict(error)) continue;
        if (
          error instanceof AuthorizationDeniedError ||
          error instanceof MembershipOwnershipProtectedError ||
          error instanceof MembershipLastWorkspaceProtectedError
        ) {
          throw error;
        }
        this.logger.error(
          JSON.stringify({
            event: 'membership.self_leave_failed',
            errorType: error instanceof Error ? error.name : 'UnknownError',
            errorCode: readSafeErrorCode(error),
          }),
        );
        throw new MembershipAdministrationUnavailableError();
      }
    }
    await this.sessionRevocations.clearCachesBestEffort(revokedSessions);
  }
}

class MembershipWriteConflictError extends Error {}

function isWriteConflict(error: unknown): boolean {
  return (
    error instanceof MembershipWriteConflictError ||
    isTransactionWriteConflict(error)
  );
}

function readSafeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  return typeof error.code === 'string' ? error.code : undefined;
}
