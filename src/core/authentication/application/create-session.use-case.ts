import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditLog } from '../../audit/application/audit-log';
import { AppConfig } from '../../configuration/app-config';
import { PasswordIdentityAuthentication } from '../../identity/application/password-identity-authentication';
import { Memberships } from '../../memberships/application/memberships';
import { Users } from '../../users/application/users';
import { Clock } from '../../../shared/application/clock';
import { IdentifierFactory } from '../../../shared/application/identifier-factory';
import { TRANSACTION_MANAGER } from '../../../shared/application/transaction-manager.port';
import type { TransactionManager } from '../../../shared/application/transaction-manager.port';
import {
  AuthenticationInvalidError,
  AuthenticationUnavailableError,
  WorkspaceSelectionRequiredError,
} from '../domain/registration.errors';
import { AccessibleWorkspaces } from './accessible-workspaces';
import { AuthenticationSessions } from './authentication-sessions';
import { SESSION_CACHE } from './session-cache.port';
import type { SessionCachePort } from './session-cache.port';
import { SessionTokenService } from './session-token.service';

export type CreateSessionCommand = {
  email: string;
  password: string;
  workspaceId?: string;
};

export type CreatedSession = {
  user: { id: string; displayName: string };
  organization: { id: string; name: string };
  workspace: { id: string; name: string };
  membership: { role: 'OWNER' };
  sessionToken: string;
  sessionExpiresAt: Date;
};

@Injectable()
export class CreateSession {
  private readonly logger = new Logger(CreateSession.name);

  constructor(
    private readonly passwordIdentities: PasswordIdentityAuthentication,
    private readonly users: Users,
    private readonly memberships: Memberships,
    private readonly accessibleWorkspaces: AccessibleWorkspaces,
    private readonly sessions: AuthenticationSessions,
    private readonly auditLog: AuditLog,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
    @Inject(SESSION_CACHE) private readonly sessionCache: SessionCachePort,
    private readonly sessionTokens: SessionTokenService,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
    private readonly config: AppConfig,
  ) {}

  async execute(command: CreateSessionCommand): Promise<CreatedSession> {
    const context = await this.authenticateAndResolveContext(command);
    const session = this.sessionTokens.create();
    const sessionId = this.identifiers.create();
    const sessionExpiresAt = new Date(
      this.clock.now().getTime() + this.config.sessionTtlSeconds * 1000,
    );

    try {
      await this.transactions.execute(async () => {
        const membership = await this.memberships.find({
          workspaceId: context.workspace.id,
          userId: context.user.id,
        });
        if (!membership || membership.role !== 'OWNER') {
          throw new LoginContextChangedError();
        }

        await this.sessions.create({
          id: sessionId,
          tokenHash: session.hash,
          userId: context.user.id,
          activeWorkspaceId: context.workspace.id,
          expiresAt: sessionExpiresAt,
        });
        await this.auditLog.append({
          id: this.identifiers.create(),
          workspaceId: context.workspace.id,
          actorUserId: context.user.id,
          action: 'auth.session.created',
          resourceId: sessionId,
        });
      });
    } catch (error) {
      this.logFailure('authentication.session_create_failed', error);
      throw new AuthenticationUnavailableError();
    }

    await this.sessionCache
      .store(
        session.hash,
        { userId: context.user.id, workspaceId: context.workspace.id },
        sessionExpiresAt,
      )
      .catch(() => undefined);

    return {
      ...context,
      sessionToken: session.raw,
      sessionExpiresAt,
    };
  }

  private async authenticateAndResolveContext(
    command: CreateSessionCommand,
  ): Promise<Omit<CreatedSession, 'sessionToken' | 'sessionExpiresAt'>> {
    try {
      const identity = await this.passwordIdentities.authenticate({
        email: command.email,
        password: command.password,
      });
      if (!identity) {
        throw new AuthenticationInvalidError();
      }

      const user = await this.users.findActiveByIdentityId(identity.identityId);
      if (!user) {
        throw new AuthenticationInvalidError();
      }

      const selected = command.workspaceId
        ? await this.accessibleWorkspaces.findForUser({
            userId: user.id,
            workspaceId: command.workspaceId,
          })
        : undefined;
      const availableWorkspaces = command.workspaceId
        ? []
        : await this.accessibleWorkspaces.listForUser(user.id);
      const resolved =
        selected ??
        (availableWorkspaces.length === 1 ? availableWorkspaces[0] : undefined);
      if (!command.workspaceId && availableWorkspaces.length > 1) {
        throw new WorkspaceSelectionRequiredError(availableWorkspaces);
      }
      if (!resolved) {
        throw new AuthenticationInvalidError();
      }

      return {
        user,
        organization: resolved.organization,
        workspace: resolved.workspace,
        membership: resolved.membership,
      };
    } catch (error) {
      if (
        error instanceof AuthenticationInvalidError ||
        error instanceof WorkspaceSelectionRequiredError
      ) {
        throw error;
      }
      this.logFailure('authentication.credential_check_failed', error);
      throw new AuthenticationUnavailableError();
    }
  }

  private logFailure(event: string, error: unknown): void {
    this.logger.error(
      JSON.stringify({
        event,
        errorType: error instanceof Error ? error.name : 'UnknownError',
        errorCode: readSafeErrorCode(error),
      }),
    );
  }
}

class LoginContextChangedError extends Error {}

function readSafeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  return typeof error.code === 'string' ? error.code : undefined;
}
