import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditLog } from '../../audit/application/audit-log';
import { AppConfig } from '../../configuration/app-config';
import { PasswordIdentityAuthentication } from '../../identity/application/password-identity-authentication';
import { Memberships } from '../../memberships/application/memberships';
import { Organizations } from '../../organizations/application/organizations';
import { Users } from '../../users/application/users';
import { Workspaces } from '../../workspaces/application/workspaces';
import { Clock } from '../../../shared/application/clock';
import { IdentifierFactory } from '../../../shared/application/identifier-factory';
import { TRANSACTION_MANAGER } from '../../../shared/application/transaction-manager.port';
import type { TransactionManager } from '../../../shared/application/transaction-manager.port';
import {
  AuthenticationInvalidError,
  AuthenticationUnavailableError,
} from '../domain/registration.errors';
import { AuthenticationSessions } from './authentication-sessions';
import { SESSION_CACHE } from './session-cache.port';
import type { SessionCachePort } from './session-cache.port';
import { SessionTokenService } from './session-token.service';

export type CreateSessionCommand = { email: string; password: string };

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
    private readonly workspaces: Workspaces,
    private readonly organizations: Organizations,
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

      const resolution = await this.memberships.resolveLoginWorkspace(user.id);
      if (resolution.kind !== 'selected') {
        throw new AuthenticationInvalidError();
      }

      const workspace = await this.workspaces.findById(
        resolution.membership.workspaceId,
      );
      if (!workspace) {
        throw new AuthenticationInvalidError();
      }
      const organization = await this.organizations.findById(
        workspace.organizationId,
      );
      if (!organization) {
        throw new AuthenticationInvalidError();
      }

      return {
        user,
        organization,
        workspace: { id: workspace.id, name: workspace.name },
        membership: { role: 'OWNER' },
      };
    } catch (error) {
      if (error instanceof AuthenticationInvalidError) {
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
