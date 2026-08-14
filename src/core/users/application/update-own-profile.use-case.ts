import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditLog } from '../../audit/application/audit-log';
import { MembershipSessionRevocations } from '../../authentication/application/membership-session-revocations';
import { Clock } from '../../../shared/application/clock';
import { IdentifierFactory } from '../../../shared/application/identifier-factory';
import { TRANSACTION_MANAGER } from '../../../shared/application/transaction-manager.port';
import type { TransactionManager } from '../../../shared/application/transaction-manager.port';
import { isTransactionWriteConflict } from '../../../shared/application/transaction-write-conflict';
import {
  UserLifecycleInvalidError,
  UserLifecycleUnavailableError,
} from '../domain/user-lifecycle.errors';
import {
  USERS_REPOSITORY,
  type UsersRepository,
  type UserSummary,
} from './users';

/** Coordinates a trusted actor's atomic self-profile update and audit record. */
@Injectable()
export class UpdateOwnProfile {
  private readonly logger = new Logger(UpdateOwnProfile.name);

  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly users: UsersRepository,
    @Inject(MembershipSessionRevocations)
    private readonly sessionAuthority: Pick<
      MembershipSessionRevocations,
      'hasActiveContext'
    >,
    private readonly auditLog: AuditLog,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
  ) {}

  /**
   * Revalidates the session and active user inside the transaction, then uses
   * compare-and-swap to prevent a stale profile overwrite. A no-op returns the
   * existing snapshot without an audit write. One write conflict is retried;
   * exhausted or unexpected failures become a safe retryable error.
   */
  async execute(input: {
    sessionId: string;
    actorUserId: string;
    workspaceId: string;
    displayName: string;
  }): Promise<UserSummary> {
    const displayName = input.displayName.trim();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.transactions.execute(async () => {
          const now = this.clock.now();
          const [sessionIsActive, user] = await Promise.all([
            this.sessionAuthority.hasActiveContext({
              sessionId: input.sessionId,
              userId: input.actorUserId,
              workspaceId: input.workspaceId,
              now,
            }),
            this.users.findById(input.actorUserId),
          ]);
          if (!sessionIsActive || !user || user.status !== 'ACTIVE') {
            throw new UserLifecycleInvalidError();
          }
          if (user.displayName === displayName) return user;

          if (
            !(await this.users.updateDisplayName({
              id: user.id,
              expectedDisplayName: user.displayName,
              displayName,
            }))
          ) {
            throw new UserWriteConflictError();
          }
          await this.auditLog.append({
            id: this.identifiers.create(),
            workspaceId: input.workspaceId,
            actorUserId: input.actorUserId,
            action: 'user.profile.updated',
            resourceId: input.actorUserId,
          });
          return Object.freeze({ ...user, displayName });
        });
      } catch (error) {
        if (attempt === 0 && isWriteConflict(error)) continue;
        if (error instanceof UserLifecycleInvalidError) throw error;
        this.logger.error(
          JSON.stringify({
            event: 'user.profile_update_failed',
            errorType: error instanceof Error ? error.name : 'UnknownError',
            errorCode: readSafeErrorCode(error),
          }),
        );
        throw new UserLifecycleUnavailableError();
      }
    }
    throw new UserLifecycleUnavailableError();
  }
}

/** Internal signal that the optimistic profile update lost a race. */
class UserWriteConflictError extends Error {}

/** Recognizes both local CAS misses and adapter transaction conflicts. */
function isWriteConflict(error: unknown): boolean {
  return (
    error instanceof UserWriteConflictError || isTransactionWriteConflict(error)
  );
}

/** Extracts only a safe diagnostic code for structured failure logging. */
function readSafeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  return typeof error.code === 'string' ? error.code : undefined;
}
