import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuthorizationPolicy } from '../../authorization/application/authorization-policy';
import { AuthorizationDeniedError } from '../../authorization/application/authorization-denied.error';
import { Users } from '../../users/application/users';
import { TRANSACTION_MANAGER } from '../../../shared/application/transaction-manager.port';
import type { TransactionManager } from '../../../shared/application/transaction-manager.port';
import {
  MembershipAdministrationUnavailableError,
  MembershipPageCursorInvalidError,
} from '../domain/membership-administration.errors';
import { MembershipAdministration } from './membership-administration';
import type { MembershipRole } from './membership-role';

/** Public member data returned from an authorized workspace list. */
export type WorkspaceMembershipListItem = Readonly<{
  id: string;
  user: Readonly<{
    id: string;
    displayName: string;
  }>;
  role: MembershipRole;
  createdAt: Date;
}>;

/** Cursor page of active memberships within one trusted workspace. */
export type WorkspaceMembershipPage = Readonly<{
  memberships: readonly WorkspaceMembershipListItem[];
  nextCursor: string | null;
}>;

/** Lists active memberships after transaction-time actor reauthorization. */
@Injectable()
export class ListWorkspaceMemberships {
  private readonly logger = new Logger(ListWorkspaceMemberships.name);

  constructor(
    private readonly memberships: MembershipAdministration,
    private readonly users: Users,
    private readonly authorization: AuthorizationPolicy,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
  ) {}

  /**
   * Returns one bounded page from the trusted workspace and resolves public user
   * display data. Foreign or removed cursors fail as invalid rather than leaking.
   */
  async execute(input: {
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
        if (
          !actor ||
          !this.authorization.permits(actor.role, 'membership:read')
        ) {
          throw new AuthorizationDeniedError();
        }

        const records = await this.memberships.listActive({
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
            user: Object.freeze({
              id: user.id,
              displayName: user.displayName,
            }),
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
      this.logFailure(error);
      throw new MembershipAdministrationUnavailableError();
    }
  }

  /** Logs only safe failure metadata and omits member data. */
  private logFailure(error: unknown): void {
    this.logger.error(
      JSON.stringify({
        event: 'membership.list_failed',
        errorType: error instanceof Error ? error.name : 'UnknownError',
        errorCode: readSafeErrorCode(error),
      }),
    );
  }
}

/** Signals an internal cross-module data mismatch without exposing details. */
class MembershipAdministrationStateError extends Error {}

/** Extracts only a safe database-style code for redacted logging. */
function readSafeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  return typeof error.code === 'string' ? error.code : undefined;
}
