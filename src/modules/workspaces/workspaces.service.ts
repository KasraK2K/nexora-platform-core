import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { SessionStateService } from '../authentication/session-state/session-state.service';
import {
  AuthorizationDeniedError,
  AuthorizationPolicyService,
} from '../authorization/policy/authorization-policy.service';
import { MembershipsService } from '../memberships/memberships.service';
import { Clock } from '../../common/clock';
import { IdentifierFactory } from '../../common/identifier-factory';
import { TRANSACTION_MANAGER } from '../../common/transaction-manager';
import type { TransactionManager } from '../../common/transaction-manager';
import { isTransactionWriteConflict } from '../../common/transaction-write-conflict';
import {
  WorkspaceLifecycleInvalidError,
  WorkspaceLifecycleUnavailableError,
} from './workspaces.errors';
import { WorkspacesRepository } from './workspaces.repository';
import type { WorkspaceSummary } from './workspaces.types';

export type { WorkspaceSummary } from './workspaces.types';

/** Public service for Workspace-owned tenant state and lifecycle behavior. */
@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger('RenameCurrentWorkspace');

  constructor(
    private readonly repository: WorkspacesRepository,
    private readonly memberships: MembershipsService,
    private readonly sessionAuthority: SessionStateService,
    private readonly authorization: AuthorizationPolicyService,
    private readonly audit: AuditService,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
  ) {}

  /** Creates a workspace inside the caller-owned transaction. */
  create(input: {
    id: string;
    organizationId: string;
    name: string;
  }): Promise<void> {
    return this.repository.create(input);
  }

  /** Finds a workspace by stable identifier. */
  findById(id: string): Promise<WorkspaceSummary | null> {
    return this.repository.findById(id);
  }

  /** Resolves a bounded set of workspace summaries. */
  findByIds(ids: readonly string[]): Promise<WorkspaceSummary[]> {
    return this.repository.findByIds(ids);
  }

  /** Revalidates and atomically renames the trusted active workspace. */
  async renameCurrent(input: {
    sessionId: string;
    actorUserId: string;
    organizationId: string;
    workspaceId: string;
    name: string;
  }): Promise<WorkspaceSummary> {
    const name = input.name.trim();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.transactions.execute(async () => {
          const now = this.clock.now();
          const [sessionIsActive, membership, workspace] = await Promise.all([
            this.sessionAuthority.hasActiveContext({
              sessionId: input.sessionId,
              userId: input.actorUserId,
              workspaceId: input.workspaceId,
              now,
            }),
            this.memberships.find({
              workspaceId: input.workspaceId,
              userId: input.actorUserId,
            }),
            this.repository.findById(input.workspaceId),
          ]);
          if (!sessionIsActive || !workspace) {
            throw new WorkspaceLifecycleInvalidError();
          }
          if (
            workspace.organizationId !== input.organizationId ||
            !membership ||
            !this.authorization.permits(membership.role, 'workspace:update')
          ) {
            throw new AuthorizationDeniedError();
          }
          if (workspace.name === name) return workspace;

          const renamed = await this.repository.rename({
            id: workspace.id,
            organizationId: input.organizationId,
            expectedName: workspace.name,
            name,
          });
          if (!renamed) throw new WorkspaceWriteConflictError();

          await this.audit.append({
            id: this.identifiers.create(),
            workspaceId: input.workspaceId,
            actorUserId: input.actorUserId,
            action: 'workspace.renamed',
            resourceId: input.workspaceId,
          });
          return Object.freeze({ ...workspace, name });
        });
      } catch (error) {
        if (attempt === 0 && isWriteConflict(error)) continue;
        if (
          error instanceof AuthorizationDeniedError ||
          error instanceof WorkspaceLifecycleInvalidError
        ) {
          throw error;
        }
        this.logger.error(
          JSON.stringify({
            event: 'workspace.rename_failed',
            errorType: error instanceof Error ? error.name : 'UnknownError',
            errorCode: readSafeErrorCode(error),
          }),
        );
        throw new WorkspaceLifecycleUnavailableError();
      }
    }
    throw new WorkspaceLifecycleUnavailableError();
  }
}

/** Internal signal used to retry one compare-and-set race. */
class WorkspaceWriteConflictError extends Error {}

/** Recognizes local and transaction-manager write conflicts. */
function isWriteConflict(error: unknown): boolean {
  return (
    error instanceof WorkspaceWriteConflictError ||
    isTransactionWriteConflict(error)
  );
}

/** Extracts only a non-sensitive string code for structured logs. */
function readSafeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  return typeof error.code === 'string' ? error.code : undefined;
}
