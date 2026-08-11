import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditLog } from '../../audit/application/audit-log';
import { AuthorizationPolicy } from '../../authorization/application/authorization-policy';
import { AuthorizationDeniedError } from '../../authorization/application/authorization-denied.error';
import { IdentifierFactory } from '../../../shared/application/identifier-factory';
import { TRANSACTION_MANAGER } from '../../../shared/application/transaction-manager.port';
import type { TransactionManager } from '../../../shared/application/transaction-manager.port';
import {
  MembershipAdministrationUnavailableError,
  MembershipOwnershipProtectedError,
} from '../domain/membership-administration.errors';
import { MembershipAdministration } from './membership-administration';
import type { InvitableMembershipRole } from './membership-role';

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

class MembershipWriteConflictError extends Error {}

function isWriteConflict(error: unknown): boolean {
  return (
    error instanceof MembershipWriteConflictError ||
    readSafeErrorCode(error) === 'P2034'
  );
}

function readSafeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  return typeof error.code === 'string' ? error.code : undefined;
}
