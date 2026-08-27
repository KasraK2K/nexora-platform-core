import { Inject, Injectable, Logger } from '@nestjs/common';
import { Clock } from '../../common/clock';
import { readSafeErrorCode } from '../../common/errors/safe-error-code';
import { IdentifierFactory } from '../../common/identifier-factory';
import { TRANSACTION_MANAGER } from '../../common/transaction-manager';
import type { TransactionManager } from '../../common/transaction-manager';
import { isTransactionWriteConflict } from '../../common/transaction-write-conflict';
import { AuditService } from '../audit/audit.service';
import { AuthorizationDeniedError } from '../authorization/authorization.errors';
import type { WorkspaceRole } from '../authorization/authorization.policy';
import { SessionsService } from '../sessions/sessions.service';
import { UsersService } from '../users/users.service';
import {
  MembershipsUnavailableError,
  MembershipOwnershipProtectedError,
  MembershipPageCursorInvalidError,
} from './errors/memberships.errors';
import {
  MembershipsRepository,
  type MembershipSummary,
} from './memberships.repository';

export type { MembershipSummary } from './memberships.repository';
export type { WorkspaceRole } from '../authorization/authorization.policy';

/** Public member summary with a role derived from permanent ownership. */
export type WorkspaceMembershipListItem = Readonly<{
  id: string;
  user: Readonly<{ id: string; displayName: string }>;
  role: WorkspaceRole;
  createdAt: Date;
}>;

/** Bounded membership page and its next opaque row cursor. */
export type WorkspaceMembershipPage = Readonly<{
  memberships: readonly WorkspaceMembershipListItem[];
  nextCursor: string | null;
}>;

/** Public service for membership lookup, listing, leave, and removal. */
@Injectable()
export class MembershipsService {
  private readonly logger = new Logger(MembershipsService.name);

  constructor(
    private readonly memberships: MembershipsRepository,
    private readonly sessions: SessionsService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
  ) {}

  createOwner(input: {
    id: string;
    workspaceId: string;
    userId: string;
  }): Promise<void> {
    return this.memberships.createOwner(input);
  }

  createInvited(input: {
    id: string;
    workspaceId: string;
    userId: string;
  }): Promise<void> {
    return this.memberships.createInvited(input);
  }

  find(input: {
    workspaceId: string;
    userId: string;
  }): Promise<MembershipSummary | null> {
    return this.memberships.find(input);
  }

  listForUser(userId: string, limit: number): Promise<MembershipSummary[]> {
    return this.memberships.listForUser(userId, limit);
  }

  /** Lists an owner-authorized page in the active workspace. */
  async listWorkspace(input: {
    actorUserId: string;
    workspaceId: string;
    cursor?: string;
    limit: number;
  }): Promise<WorkspaceMembershipPage> {
    try {
      return await this.transactions.execute(async () => {
        const actor = await this.memberships.findActiveForUser(
          input.workspaceId,
          input.actorUserId,
        );
        if (actor?.role !== 'OWNER') throw new AuthorizationDeniedError();
        const records = await this.memberships.listActive({
          workspaceId: input.workspaceId,
          cursor: input.cursor,
          limit: input.limit + 1,
        });
        if (!records) throw new MembershipPageCursorInvalidError();
        const pageRecords = records.slice(0, input.limit);
        const users = await Promise.all(
          pageRecords.map(({ userId }) => this.users.findById(userId)),
        );
        const page = pageRecords.map((membership, index) => {
          const user = users[index];
          if (!user) throw new MembershipStateError();
          return Object.freeze({
            id: membership.id,
            user: Object.freeze({ id: user.id, displayName: user.displayName }),
            role: membership.role,
            createdAt: membership.createdAt,
          });
        });
        return Object.freeze({
          memberships: page,
          nextCursor:
            records.length > input.limit
              ? (page[page.length - 1]?.id ?? null)
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
      this.log('membership.list_failed', error);
      throw new MembershipsUnavailableError();
    }
  }

  /** Leaves one member workspace and revokes only that workspace's sessions. */
  async leaveCurrent(input: {
    sessionId: string;
    actorUserId: string;
    workspaceId: string;
  }): Promise<void> {
    await this.retryWrite('membership.self_leave_failed', async () => {
      const now = this.clock.now();
      const [sessionIsActive, membership] = await Promise.all([
        this.sessions.hasActiveContext({
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
      if (!sessionIsActive || !membership) {
        throw new AuthorizationDeniedError();
      }
      if (membership.role === 'OWNER') {
        throw new MembershipOwnershipProtectedError();
      }
      await this.sessions.revokeActiveForMembership({
        userId: input.actorUserId,
        workspaceId: input.workspaceId,
        revokedAt: now,
      });
      if (
        !(await this.memberships.remove({
          workspaceId: input.workspaceId,
          membershipId: membership.id,
          removedAt: now,
        }))
      ) {
        throw new MembershipWriteConflictError();
      }
      await this.audit.append({
        id: this.identifiers.create(),
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        action: 'membership.left',
        resourceId: membership.id,
      });
    });
  }

  /** Lets the permanent owner remove a member and their scoped sessions. */
  async remove(input: {
    actorUserId: string;
    workspaceId: string;
    membershipId: string;
  }): Promise<void> {
    await this.retryWrite('membership.remove_failed', async () => {
      const now = this.clock.now();
      const [actor, target] = await Promise.all([
        this.memberships.findActiveForUser(
          input.workspaceId,
          input.actorUserId,
        ),
        this.memberships.findActiveById(input.workspaceId, input.membershipId),
      ]);
      if (actor?.role !== 'OWNER') throw new AuthorizationDeniedError();
      if (!target) return;
      if (target.role === 'OWNER') {
        throw new MembershipOwnershipProtectedError();
      }
      await this.sessions.revokeActiveForMembership({
        userId: target.userId,
        workspaceId: input.workspaceId,
        revokedAt: now,
      });
      if (
        !(await this.memberships.remove({
          workspaceId: input.workspaceId,
          membershipId: target.id,
          removedAt: now,
        }))
      ) {
        throw new MembershipWriteConflictError();
      }
      await this.audit.append({
        id: this.identifiers.create(),
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        action: 'membership.removed',
        resourceId: target.id,
      });
    });
  }

  private async retryWrite(
    event: string,
    operation: () => Promise<void>,
  ): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await this.transactions.execute(operation);
        return;
      } catch (error) {
        if (
          attempt === 0 &&
          (error instanceof MembershipWriteConflictError ||
            isTransactionWriteConflict(error))
        ) {
          continue;
        }
        if (
          error instanceof AuthorizationDeniedError ||
          error instanceof MembershipOwnershipProtectedError
        ) {
          throw error;
        }
        this.log(event, error);
        throw new MembershipsUnavailableError();
      }
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

class MembershipStateError extends Error {}
class MembershipWriteConflictError extends Error {}
