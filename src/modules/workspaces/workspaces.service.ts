import { Inject, Injectable, Logger } from '@nestjs/common';
import { Clock } from '../../common/clock';
import { IdentifierFactory } from '../../common/identifier-factory';
import { logSafeFailure } from '../../common/logging/log-safe-failure';
import { retryOnceOnWriteConflict } from '../../common/transaction-retry';
import { TRANSACTION_MANAGER } from '../../common/transaction-manager';
import type { TransactionManager } from '../../common/transaction-manager';
import { isTransactionWriteConflict } from '../../common/transaction-write-conflict';
import { AuditService } from '../audit/audit.service';
import { AuthorizationDeniedError } from '../authorization/authorization.errors';
import { MembershipsService } from '../memberships/memberships.service';
import { SessionsService } from '../sessions/sessions.service';
import {
  WorkspaceLifecycleInvalidError,
  WorkspaceLifecycleUnavailableError,
} from './workspaces.errors';
import { WorkspacesRepository } from './workspaces.repository';
import type { WorkspaceSummary } from './workspaces.types';

export type { WorkspaceSummary } from './workspaces.types';

/** Public service for permanent ownership and workspace lifecycle behavior. */
@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(
    private readonly repository: WorkspacesRepository,
    private readonly memberships: MembershipsService,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
  ) {}

  /** Creates a workspace inside a caller-owned transaction. */
  create(input: {
    id: string;
    ownerUserId: string;
    name: string;
  }): Promise<void> {
    return this.repository.create(input);
  }

  findById(id: string): Promise<WorkspaceSummary | null> {
    return this.repository.findById(id);
  }

  findByIds(ids: readonly string[]): Promise<WorkspaceSummary[]> {
    return this.repository.findByIds(ids);
  }

  /** Creates another independently owned workspace without switching session. */
  async createOwned(input: {
    sessionId: string;
    actorUserId: string;
    currentWorkspaceId: string;
    name: string;
  }): Promise<WorkspaceSummary> {
    const workspace: WorkspaceSummary = {
      id: this.identifiers.create(),
      ownerUserId: input.actorUserId,
      name: input.name.trim(),
    };
    try {
      await this.transactions.execute(async () => {
        if (
          !(await this.sessions.hasActiveContext({
            sessionId: input.sessionId,
            userId: input.actorUserId,
            workspaceId: input.currentWorkspaceId,
            now: this.clock.now(),
          }))
        ) {
          throw new WorkspaceLifecycleInvalidError();
        }
        await this.repository.create(workspace);
        await this.memberships.createOwner({
          id: this.identifiers.create(),
          workspaceId: workspace.id,
          userId: input.actorUserId,
        });
        await this.audit.append({
          id: this.identifiers.create(),
          workspaceId: workspace.id,
          actorUserId: input.actorUserId,
          action: 'workspace.created',
          resourceId: workspace.id,
        });
      });
      return Object.freeze(workspace);
    } catch (error) {
      if (error instanceof WorkspaceLifecycleInvalidError) throw error;
      logSafeFailure(this.logger, 'workspace.create_failed', error);
      throw new WorkspaceLifecycleUnavailableError();
    }
  }

  /** Revalidates and atomically renames the owner-managed active workspace. */
  async renameCurrent(input: {
    sessionId: string;
    actorUserId: string;
    workspaceId: string;
    name: string;
  }): Promise<WorkspaceSummary> {
    const name = input.name.trim();
    try {
      return await retryOnceOnWriteConflict(
        () =>
          this.transactions.execute(async () => {
            const [sessionIsActive, membership, workspace] = await Promise.all([
              this.sessions.hasActiveContext({
                sessionId: input.sessionId,
                userId: input.actorUserId,
                workspaceId: input.workspaceId,
                now: this.clock.now(),
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
              membership?.role !== 'OWNER' ||
              workspace.ownerUserId !== input.actorUserId
            ) {
              throw new AuthorizationDeniedError();
            }
            if (workspace.name === name) return workspace;
            if (
              !(await this.repository.rename({
                id: workspace.id,
                ownerUserId: input.actorUserId,
                expectedName: workspace.name,
                name,
              }))
            ) {
              throw new WorkspaceWriteConflictError();
            }
            await this.audit.append({
              id: this.identifiers.create(),
              workspaceId: input.workspaceId,
              actorUserId: input.actorUserId,
              action: 'workspace.renamed',
              resourceId: input.workspaceId,
            });
            return Object.freeze({ ...workspace, name });
          }),
        isWriteConflict,
      );
    } catch (error) {
      if (
        error instanceof AuthorizationDeniedError ||
        error instanceof WorkspaceLifecycleInvalidError
      ) {
        throw error;
      }
      logSafeFailure(this.logger, 'workspace.rename_failed', error);
      throw new WorkspaceLifecycleUnavailableError();
    }
  }
}

class WorkspaceWriteConflictError extends Error {}

function isWriteConflict(error: unknown): boolean {
  return (
    error instanceof WorkspaceWriteConflictError ||
    isTransactionWriteConflict(error)
  );
}
