import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditLog } from '../../audit/application/audit-log';
import { Memberships } from '../../memberships/application/memberships';
import { Users } from '../../users/application/users';
import { Clock } from '../../../shared/application/clock';
import { IdentifierFactory } from '../../../shared/application/identifier-factory';
import { TRANSACTION_MANAGER } from '../../../shared/application/transaction-manager.port';
import type { TransactionManager } from '../../../shared/application/transaction-manager.port';
import {
  AuthenticationRequiredError,
  WorkspaceAccessDeniedError,
  WorkspaceSwitchUnavailableError,
} from '../domain/registration.errors';
import { AccessibleWorkspaces } from './accessible-workspaces';
import type { AuthenticatedRequestContext } from './authenticated-request-context';
import {
  AuthenticationSessions,
  type SessionRecord,
} from './authentication-sessions';
import type { CurrentSession } from './get-current-session.use-case';
import { SESSION_CACHE } from './session-cache.port';
import type { SessionCachePort } from './session-cache.port';
import { SessionTokenService } from './session-token.service';

export type SwitchedWorkspaceSession = Readonly<{
  currentSession: CurrentSession;
  sessionToken: string;
  sessionExpiresAt: Date;
  rotated: boolean;
}>;

@Injectable()
export class SwitchWorkspace {
  private readonly logger = new Logger(SwitchWorkspace.name);

  constructor(
    private readonly sessions: AuthenticationSessions,
    private readonly users: Users,
    private readonly memberships: Memberships,
    private readonly accessibleWorkspaces: AccessibleWorkspaces,
    private readonly auditLog: AuditLog,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
    @Inject(SESSION_CACHE) private readonly sessionCache: SessionCachePort,
    private readonly sessionTokens: SessionTokenService,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    rawSessionToken: string | undefined;
    expectedContext: AuthenticatedRequestContext;
    workspaceId: string;
  }): Promise<SwitchedWorkspaceSession> {
    const rawSessionToken = input.rawSessionToken;
    const tokenHash = this.sessionTokens.hashIfValid(rawSessionToken);
    if (!rawSessionToken || !tokenHash) {
      throw new AuthenticationRequiredError();
    }

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
          if (
            !user ||
            user.status !== 'ACTIVE' ||
            !sourceMembership ||
            sourceMembership.role !== 'OWNER'
          ) {
            throw new AuthenticationRequiredError();
          }
          if (!target) {
            throw new WorkspaceAccessDeniedError();
          }

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
            await this.auditLog.append({
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
        if (attempt === 0 && isWriteConflict(error)) {
          continue;
        }
        if (
          error instanceof AuthenticationRequiredError ||
          error instanceof WorkspaceAccessDeniedError
        ) {
          throw error;
        }
        this.logFailure(error);
        throw new WorkspaceSwitchUnavailableError();
      }
    }

    if (!result) {
      throw new WorkspaceSwitchUnavailableError();
    }

    if (result.rotated) {
      await this.sessionCache.remove(tokenHash).catch(() => undefined);
      await this.sessionCache
        .store(
          replacement.hash,
          {
            userId: input.expectedContext.actorUserId,
            workspaceId: input.workspaceId,
          },
          result.sessionExpiresAt,
        )
        .catch(() => undefined);
    }

    return result;
  }

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

  private logFailure(error: unknown): void {
    this.logger.error(
      JSON.stringify({
        event: 'authentication.workspace_switch_failed',
        errorType: error instanceof Error ? error.name : 'UnknownError',
        errorCode: readSafeErrorCode(error),
      }),
    );
  }
}

function isWriteConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2034'
  );
}

function readSafeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  return typeof error.code === 'string' ? error.code : undefined;
}
