import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { MembershipsService } from '../../memberships/memberships.service';
import { UsersService } from '../../users/users.service';
import { Clock } from '../../../common/clock';
import { IdentifierFactory } from '../../../common/identifier-factory';
import { logSafeFailure } from '../../../common/logging/log-safe-failure';
import { retryOnceOnWriteConflict } from '../../../common/transaction-retry';
import { TRANSACTION_MANAGER } from '../../../common/transaction-manager';
import type { TransactionManager } from '../../../common/transaction-manager';
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
import {
  SessionsService,
  type SessionRecord,
} from '../../sessions/sessions.service';
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
    private readonly sessions: SessionsService,
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
      logSafeFailure(
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
    try {
      result = await retryOnceOnWriteConflict(() =>
        this.transactions.execute(async () => {
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
            workspace: target.workspace,
            membership: target.membership,
          });
          if (session.workspaceId === input.workspaceId) {
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
            workspaceId: input.workspaceId,
            expiresAt: session.expiresAt,
          });
          for (const workspaceId of [session.workspaceId, input.workspaceId]) {
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
        }),
      );
    } catch (error) {
      if (
        error instanceof AuthenticationRequiredError ||
        error instanceof WorkspaceAccessDeniedError
      ) {
        throw error;
      }
      logSafeFailure(
        this.switchLogger,
        'authentication.workspace_switch_failed',
        error,
      );
      throw new WorkspaceSwitchUnavailableError();
    }
    if (!result) throw new WorkspaceSwitchUnavailableError();
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
      session.workspaceId !== expected.workspaceId ||
      session.revokedAt ||
      session.expiresAt.getTime() <= now.getTime()
    ) {
      throw new AuthenticationRequiredError();
    }
    return session;
  }
}
