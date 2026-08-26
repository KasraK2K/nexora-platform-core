import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import {
  SessionStateService,
  type RevokedSessionState,
} from '../authentication/session-state/session-state.service';
import {
  AuthorizationDeniedError,
  AuthorizationPolicyService,
} from '../authorization/policy/authorization-policy.service';
import { PasswordCredentialsService } from '../identity/password-credentials.service';
import { UsersService } from '../users/users.service';
import { Clock } from '../../common/clock';
import { IdentifierFactory } from '../../common/identifier-factory';
import { readSafeErrorCode } from '../../common/errors/safe-error-code';
import { TRANSACTION_MANAGER } from '../../common/transaction-manager';
import type { TransactionManager } from '../../common/transaction-manager';
import { isTransactionWriteConflict } from '../../common/transaction-write-conflict';
import {
  MembershipAdministrationUnavailableError,
  MembershipLastWorkspaceProtectedError,
  MembershipOwnershipProtectedError,
  MembershipOwnershipTransferInvalidError,
  MembershipPageCursorInvalidError,
} from './errors/membership-administration.errors';
import type {
  InvitableMembershipRole,
  MembershipRole,
} from './membership-role';
import { MembershipsRepository } from './repositories/memberships.repository';

/** Public member data returned from an authorized workspace list. */
export type WorkspaceMembershipListItem = Readonly<{
  id: string;
  user: Readonly<{ id: string; displayName: string }>;
  role: MembershipRole;
  createdAt: Date;
}>;

/** Cursor page of active memberships within one trusted workspace. */
export type WorkspaceMembershipPage = Readonly<{
  memberships: readonly WorkspaceMembershipListItem[];
  nextCursor: string | null;
}>;

/** Owns membership lookup, administration, authorization, and transactions. */
@Injectable()
export class MembershipAdministrationService {
  private readonly listLogger = new Logger('ListWorkspaceMemberships');
  private readonly leaveLogger = new Logger('LeaveCurrentWorkspace');
  private readonly changeRoleLogger = new Logger('ChangeMembershipRole');
  private readonly removeLogger = new Logger('RemoveMembership');
  private readonly transferOwnershipLogger = new Logger(
    'TransferWorkspaceOwnership',
  );

  constructor(
    private readonly administration: MembershipsRepository,
    private readonly sessionState: SessionStateService,
    private readonly users: UsersService,
    private readonly passwordCredentials: PasswordCredentialsService,
    private readonly authorization: AuthorizationPolicyService,
    private readonly auditLog: AuditService,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
  ) {}

  /** Lists one authorized page of memberships in the trusted workspace. */
  async listWorkspace(input: {
    actorUserId: string;
    workspaceId: string;
    cursor?: string;
    limit: number;
  }): Promise<WorkspaceMembershipPage> {
    try {
      return await this.transactions.execute(async () => {
        const actor = await this.administration.findActiveForUser(
          input.workspaceId,
          input.actorUserId,
        );
        if (
          !actor ||
          !this.authorization.permits(actor.role, 'membership:read')
        ) {
          throw new AuthorizationDeniedError();
        }
        const records = await this.administration.listActive({
          workspaceId: input.workspaceId,
          cursor: input.cursor,
          limit: input.limit + 1,
        });
        if (!records) throw new MembershipPageCursorInvalidError();
        const hasMore = records.length > input.limit;
        const pageRecords = records.slice(0, input.limit);
        const users = await Promise.all(
          pageRecords.map((membership) =>
            this.users.findById(membership.userId),
          ),
        );
        const memberships = pageRecords.map((membership, index) => {
          const user = users[index];
          if (!user) throw new MembershipAdministrationStateError();
          return Object.freeze({
            id: membership.id,
            user: Object.freeze({ id: user.id, displayName: user.displayName }),
            role: membership.role,
            createdAt: membership.createdAt,
          });
        });
        return Object.freeze({
          memberships,
          nextCursor: hasMore
            ? (memberships[memberships.length - 1]?.id ?? null)
            : null,
        });
      });
    } catch (error) {
      if (
        error instanceof AuthorizationDeniedError ||
        error instanceof MembershipPageCursorInvalidError
      ) {
        throw error;
      }
      this.logFailure(this.listLogger, 'membership.list_failed', error);
      throw new MembershipAdministrationUnavailableError();
    }
  }

  /** Leaves the active workspace after protected lifecycle checks. */
  async leaveCurrent(input: {
    sessionId: string;
    actorUserId: string;
    workspaceId: string;
  }): Promise<void> {
    let revokedSessions: readonly RevokedSessionState[] = [];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        revokedSessions = await this.transactions.execute(async () => {
          const now = this.clock.now();
          const [sessionIsActive, membership] = await Promise.all([
            this.sessionState.hasActiveContext({
              sessionId: input.sessionId,
              userId: input.actorUserId,
              workspaceId: input.workspaceId,
              now,
            }),
            this.administration.findActiveForUser(
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
          if (membership.role === 'OWNER')
            throw new MembershipOwnershipProtectedError();
          if (!this.authorization.mayLeaveWorkspace(membership.role)) {
            throw new AuthorizationDeniedError();
          }
          if (
            !(await this.administration.hasOtherActiveForUser(
              input.actorUserId,
              input.workspaceId,
            ))
          ) {
            throw new MembershipLastWorkspaceProtectedError();
          }
          const revoked = await this.sessionState.revokeActiveForMembership({
            userId: input.actorUserId,
            workspaceId: input.workspaceId,
            revokedAt: now,
          });
          if (
            !(await this.administration.remove({
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
        this.logFailure(
          this.leaveLogger,
          'membership.self_leave_failed',
          error,
        );
        throw new MembershipAdministrationUnavailableError();
      }
    }
    await this.sessionState.clearCachesBestEffort(revokedSessions);
  }

  /** Changes a visible non-owner membership role when policy permits. */
  async changeRole(input: {
    actorUserId: string;
    workspaceId: string;
    membershipId: string;
    role: InvitableMembershipRole;
  }): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await this.transactions.execute(async () => {
          const [actor, target] = await Promise.all([
            this.administration.findActiveForUser(
              input.workspaceId,
              input.actorUserId,
            ),
            this.administration.findActiveById(
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
          if (target.role === 'OWNER')
            throw new MembershipOwnershipProtectedError();
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
            !(await this.administration.updateRole({
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
        this.logFailure(
          this.changeRoleLogger,
          'membership.role_update_failed',
          error,
        );
        throw new MembershipAdministrationUnavailableError();
      }
    }
  }

  /** Removes a visible lower-role membership and revokes scoped sessions. */
  async remove(input: {
    actorUserId: string;
    workspaceId: string;
    membershipId: string;
  }): Promise<void> {
    let revokedSessions: readonly RevokedSessionState[] = [];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        revokedSessions = await this.transactions.execute(async () => {
          const now = this.clock.now();
          const [actor, target] = await Promise.all([
            this.administration.findActiveForUser(
              input.workspaceId,
              input.actorUserId,
            ),
            this.administration.findActiveById(
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
          if (target.role === 'OWNER')
            throw new MembershipOwnershipProtectedError();
          if (!this.authorization.mayRemoveMembership(actor, target)) {
            throw new AuthorizationDeniedError();
          }
          const revoked = await this.sessionState.revokeActiveForMembership({
            userId: target.userId,
            workspaceId: input.workspaceId,
            revokedAt: now,
          });
          if (
            !(await this.administration.remove({
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
        this.logFailure(this.removeLogger, 'membership.remove_failed', error);
        throw new MembershipAdministrationUnavailableError();
      }
    }
    await this.sessionState.clearCachesBestEffort(revokedSessions);
  }

  /** Transfers operational workspace ownership after password step-up. */
  async transferOwnership(input: {
    sessionId: string;
    actorUserId: string;
    workspaceId: string;
    membershipId: string;
    currentPassword: string;
  }): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await this.transactions.execute(async () => {
          const now = this.clock.now();
          const [sessionIsActive, actor, actorUser] = await Promise.all([
            this.sessionState.hasActiveContext({
              sessionId: input.sessionId,
              userId: input.actorUserId,
              workspaceId: input.workspaceId,
              now,
            }),
            this.administration.findActiveForUser(
              input.workspaceId,
              input.actorUserId,
            ),
            this.users.findAuthenticationReferenceById(input.actorUserId),
          ]);
          if (
            !actor ||
            !this.authorization.permits(
              actor.role,
              'membership:ownership:transfer',
            )
          ) {
            throw new AuthorizationDeniedError();
          }
          if (!sessionIsActive || !actorUser || actorUser.status !== 'ACTIVE') {
            throw new MembershipOwnershipTransferInvalidError();
          }
          if (
            !(await this.passwordCredentials.verify({
              identityId: actorUser.identityId,
              password: input.currentPassword,
            }))
          ) {
            throw new MembershipOwnershipTransferInvalidError();
          }
          const [target, ownerCount] = await Promise.all([
            this.administration.findActiveById(
              input.workspaceId,
              input.membershipId,
            ),
            this.administration.countActiveOwners(input.workspaceId),
          ]);
          if (
            !target ||
            target.role === 'OWNER' ||
            ownerCount !== 1 ||
            !this.authorization.mayTransferWorkspaceOwnership(actor, target)
          ) {
            throw new MembershipOwnershipTransferInvalidError();
          }
          if (
            !(await this.administration.transferOwnership({
              workspaceId: input.workspaceId,
              currentOwnerMembershipId: actor.id,
              targetMembershipId: target.id,
              expectedTargetRole: target.role,
            }))
          ) {
            throw new MembershipWriteConflictError();
          }
          await this.auditLog.append({
            id: this.identifiers.create(),
            workspaceId: input.workspaceId,
            actorUserId: input.actorUserId,
            action: 'membership.ownership.transferred',
            resourceId: target.id,
          });
        });
        return;
      } catch (error) {
        if (attempt === 0 && isWriteConflict(error)) continue;
        if (
          error instanceof AuthorizationDeniedError ||
          error instanceof MembershipOwnershipTransferInvalidError
        ) {
          throw error;
        }
        this.logFailure(
          this.transferOwnershipLogger,
          'membership.ownership_transfer_failed',
          error,
        );
        throw new MembershipAdministrationUnavailableError();
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

/** Signals an internal cross-module member-data mismatch. */
class MembershipAdministrationStateError extends Error {}

/** Signals a compare-and-set miss that should roll back the transaction. */
class MembershipWriteConflictError extends Error {}

/** Recognizes local compare-and-set misses and adapter write conflicts. */
function isWriteConflict(error: unknown): boolean {
  return (
    error instanceof MembershipWriteConflictError ||
    isTransactionWriteConflict(error)
  );
}
