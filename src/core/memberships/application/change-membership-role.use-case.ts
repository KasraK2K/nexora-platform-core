import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditLog } from '../../audit/application/audit-log';
import { AuthorizationPolicy } from '../../authorization/application/authorization-policy';
import { AuthorizationDeniedError } from '../../authorization/application/authorization-denied.error';
import { IdentifierFactory } from '../../../shared/application/identifier-factory';
import { TRANSACTION_MANAGER } from '../../../shared/application/transaction-manager.port';
import type { TransactionManager } from '../../../shared/application/transaction-manager.port';
import { isTransactionWriteConflict } from '../../../shared/application/transaction-write-conflict';
import {
  MembershipAdministrationUnavailableError,
  MembershipOwnershipProtectedError,
} from '../domain/membership-administration.errors';
import { MembershipAdministration } from './membership-administration';
import type { InvitableMembershipRole } from './membership-role';

/**
 * Changes a non-owner role after reauthorizing both actor and target in the
 * trusted workspace. The expected-role write and audit share one transaction.
 */
@Injectable()
export class ChangeMembershipRole {
  private readonly logger = new Logger(ChangeMembershipRole.name);

  constructor(
    private readonly memberships: MembershipAdministration,
    private readonly authorization: AuthorizationPolicy,
    private readonly auditLog: AuditLog,
    private readonly identifiers: IdentifierFactory,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
  ) {}

  /**
   * Applies an allowed lower-role change, treating missing or unchanged targets
   * as no-ops and protecting OWNER changes behind explicit ownership transfer.
   */
  async execute(input: {
    actorUserId: string;
    workspaceId: string;
    membershipId: string;
    role: InvitableMembershipRole;
  }): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await this.transactions.execute(async () => {
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
            !this.authorization.permits(actor.role, 'membership:role:update')
          ) {
            throw new AuthorizationDeniedError();
          }
          if (!target) return;
          if (target.role === 'OWNER') {
            throw new MembershipOwnershipProtectedError();
          }
          if (
            !this.authorization.mayChangeMembershipRole(
              actor,
              target,
              input.role,
            )
          ) {
            throw new AuthorizationDeniedError();
          }
          if (target.role === input.role) return;

          if (
            !(await this.memberships.updateRole({
              workspaceId: input.workspaceId,
              membershipId: target.id,
              expectedRole: target.role,
              role: input.role,
            }))
          ) {
            throw new MembershipWriteConflictError();
          }
          await this.auditLog.append({
            id: this.identifiers.create(),
            workspaceId: input.workspaceId,
            actorUserId: input.actorUserId,
            action: 'membership.role.updated',
            resourceId: target.id,
          });
        });
        return;
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
  }

  /** Logs safe failure metadata without actor or target identifiers. */
  private logFailure(error: unknown): void {
    this.logger.error(
      JSON.stringify({
        event: 'membership.role_update_failed',
        errorType: error instanceof Error ? error.name : 'UnknownError',
        errorCode: readSafeErrorCode(error),
      }),
    );
  }
}

/** Signals a compare-and-set miss so the whole transaction can be retried. */
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
