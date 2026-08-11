import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditLog } from '../../audit/application/audit-log';
import { MembershipSessionRevocations } from '../../authentication/application/membership-session-revocations';
import { AuthorizationPolicy } from '../../authorization/application/authorization-policy';
import { AuthorizationDeniedError } from '../../authorization/application/authorization-denied.error';
import { Memberships } from '../../memberships/application/memberships';
import { Clock } from '../../../shared/application/clock';
import { IdentifierFactory } from '../../../shared/application/identifier-factory';
import { TRANSACTION_MANAGER } from '../../../shared/application/transaction-manager.port';
import type { TransactionManager } from '../../../shared/application/transaction-manager.port';
import { isTransactionWriteConflict } from '../../../shared/application/transaction-write-conflict';
import {
  WorkspaceLifecycleInvalidError,
  WorkspaceLifecycleUnavailableError,
} from '../domain/workspace-lifecycle.errors';
import {
  WORKSPACES_REPOSITORY,
  type WorkspacesRepository,
  type WorkspaceSummary,
} from './workspaces';

@Injectable()
export class RenameCurrentWorkspace {
  private readonly logger = new Logger(RenameCurrentWorkspace.name);

  constructor(
    @Inject(WORKSPACES_REPOSITORY)
    private readonly workspaces: WorkspacesRepository,
    private readonly memberships: Memberships,
    private readonly sessionAuthority: MembershipSessionRevocations,
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
            this.workspaces.findById(input.workspaceId),
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

          if (
            !(await this.workspaces.rename({
              id: workspace.id,
              organizationId: input.organizationId,
              expectedName: workspace.name,
              name,
            }))
          ) {
            throw new WorkspaceWriteConflictError();
          }
          await this.auditLog.append({
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

class WorkspaceWriteConflictError extends Error {}

function isWriteConflict(error: unknown): boolean {
  return (
    error instanceof WorkspaceWriteConflictError ||
    isTransactionWriteConflict(error)
  );
}

function readSafeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  return typeof error.code === 'string' ? error.code : undefined;
}
