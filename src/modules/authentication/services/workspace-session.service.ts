import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { MembershipsService } from '../../memberships/memberships.service';
import { UsersService } from '../../users/users.service';
import { Clock } from '../../../common/clock';
import { IdentifierFactory } from '../../../common/identifier-factory';
import { readSafeErrorCode } from '../../../common/errors/safe-error-code';
import { TRANSACTION_MANAGER } from '../../../common/transaction-manager';
import type { TransactionManager } from '../../../common/transaction-manager';
import { isTransactionWriteConflict } from '../../../common/transaction-write-conflict';
import {
  AuthenticationRequiredError,
  AuthenticationUnavailableError,
  WorkspaceAccessDeniedError,
  WorkspaceSwitchUnavailableError,
  type WorkspaceSelectionOption,
} from '../errors/authentication.errors';
import { AccessibleWorkspacesService } from '../services/accessible-workspaces.service';
import type { AuthenticatedRequestContext } from '../security/authenticated-request-context';
import { OpaqueTokenService } from '../../../common/security/opaque-token.service';
import type { SessionRecord } from '../repositories/authentication-sessions.repository';
import { SessionStoreService } from '../services/session-store.service';
import type { SwitchedWorkspaceSession } from './session.types';

export type { SwitchedWorkspaceSession } from './session.types';

/** Lists accessible workspaces and rotates sessions when tenant changes. */
@Injectable()
export class WorkspaceSessionService {
  private readonly listLogger = new Logger('ListSessionWorkspaces');
  private readonly switchLogger = new Logger('SwitchWorkspace');

  constructor(
    private readonly users: UsersService,
    private readonly memberships: MembershipsService,
    private readonly accessibleWorkspaces: AccessibleWorkspacesService,
    private readonly sessions: SessionStoreService,
    private readonly audit: AuditService,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
    private readonly sessionTokens: OpaqueTokenService,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
  ) {}

  /** Lists bounded workspace choices for the trusted actor. */
  async listWorkspaces(
    actorUserId: string,
  ): Promise<WorkspaceSelectionOption[]> {
    try {
      return await this.accessibleWorkspaces.listForUser(actorUserId);
    } catch (error) {
      this.logFailure(
        this.listLogger,
        'authentication.workspace_list_failed',
        error,
      );
      throw new AuthenticationUnavailableError();
    }
  }

  /** Changes the active workspace and rotates the presented session token. */
  async switchWorkspace(input: {
    rawSessionToken: string | undefined;
    expectedContext: AuthenticatedRequestContext;
    workspaceId: string;
  }): Promise<SwitchedWorkspaceSession> {
    const rawSessionToken = input.rawSessionToken;
    const tokenHash = this.sessionTokens.hashIfValid(rawSessionToken);
    if (!rawSessionToken || !tokenHash) throw new AuthenticationRequiredError();

    const replacement = this.sessionTokens.create();
    const replacementSessionId = this.identifiers.create();
    let result: SwitchedWorkspaceSession | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        result = await this.transactions.execute(async () => {
          const now = this.clock.now();
          const session = this.requireCurrentContext(
            await this.sessions.findByTokenHash(tokenHash),
            input.expectedContext,
            now,
          );
          const [user, sourceMembership, target] = await Promise.all([
            this.users.findById(input.expectedContext.actorUserId),
            this.memberships.find({
              userId: input.expectedContext.actorUserId,
              workspaceId: input.expectedContext.workspaceId,
            }),
            this.accessibleWorkspaces.findForUser({
              userId: input.expectedContext.actorUserId,
              workspaceId: input.workspaceId,
            }),
          ]);
          if (!user || user.status !== 'ACTIVE' || !sourceMembership) {
            throw new AuthenticationRequiredError();
          }
          if (!target) throw new WorkspaceAccessDeniedError();
          const currentSession = Object.freeze({
            user: Object.freeze({ ...user }),
            organization: target.organization,
            workspace: target.workspace,
            membership: target.membership,
          });
          if (session.activeWorkspaceId === input.workspaceId) {
            return Object.freeze({
              currentSession,
              sessionToken: rawSessionToken,
              sessionExpiresAt: session.expiresAt,
              rotated: false,
            });
          }
          const revoked = await this.sessions.revokeByTokenHash(tokenHash, now);
          if (!revoked || revoked.id !== session.id) {
            throw new AuthenticationRequiredError();
          }
          await this.sessions.create({
            id: replacementSessionId,
            tokenHash: replacement.hash,
            userId: session.userId,
            activeWorkspaceId: input.workspaceId,
            expiresAt: session.expiresAt,
          });
          for (const workspaceId of [
            session.activeWorkspaceId,
            input.workspaceId,
          ]) {
            await this.audit.append({
              id: this.identifiers.create(),
              workspaceId,
              actorUserId: session.userId,
              action: 'auth.workspace.switched',
              resourceId: replacementSessionId,
            });
          }
          return Object.freeze({
            currentSession,
            sessionToken: replacement.raw,
            sessionExpiresAt: session.expiresAt,
            rotated: true,
          });
        });
        break;
      } catch (error) {
        if (attempt === 0 && isTransactionWriteConflict(error)) continue;
        if (
          error instanceof AuthenticationRequiredError ||
          error instanceof WorkspaceAccessDeniedError
        ) {
          throw error;
        }
        this.logFailure(
          this.switchLogger,
          'authentication.workspace_switch_failed',
          error,
        );
        throw new WorkspaceSwitchUnavailableError();
      }
    }
    if (!result) throw new WorkspaceSwitchUnavailableError();
    if (result.rotated) {
      await this.sessions.removeCacheBestEffort(tokenHash);
      await this.sessions.storeCacheBestEffort(
        replacement.hash,
        {
          userId: input.expectedContext.actorUserId,
          workspaceId: input.workspaceId,
        },
        result.sessionExpiresAt,
      );
    }
    return result;
  }

  /** Verifies the exact session tuple captured by the admission guard. */
  private requireCurrentContext(
    session: SessionRecord | null,
    expected: AuthenticatedRequestContext,
    now: Date,
  ): SessionRecord {
    if (
      !session ||
      session.id !== expected.sessionId ||
      session.userId !== expected.actorUserId ||
      session.activeWorkspaceId !== expected.workspaceId ||
      session.revokedAt ||
      session.expiresAt.getTime() <= now.getTime()
    ) {
      throw new AuthenticationRequiredError();
    }
    return session;
  }

  /** Writes only a safe failure classification to structured logs. */
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
