import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { MembershipsService } from '../../memberships/memberships.service';
import { UsersService } from '../../users/users.service';
import { AppConfig } from '../../../config/app-config';
import { Clock } from '../../../common/clock';
import { IdentifierFactory } from '../../../common/identifier-factory';
import { logSafeFailure } from '../../../common/logging/log-safe-failure';
import { TRANSACTION_MANAGER } from '../../../common/transaction-manager';
import type { TransactionManager } from '../../../common/transaction-manager';
import {
  AuthenticationInvalidError,
  AuthenticationUnavailableError,
  WorkspaceSelectionRequiredError,
} from '../errors/authentication.errors';
import { AccessibleWorkspacesService } from '../services/accessible-workspaces.service';
import { OpaqueTokenService } from '../../../common/security/opaque-token.service';
import { SessionsService } from '../../sessions/sessions.service';
import type { CreateSessionCommand, CreatedSession } from './session.types';

export type { CreateSessionCommand, CreatedSession } from './session.types';

/** Authenticates credentials and creates one opaque durable session. */
@Injectable()
export class SessionLoginService {
  private readonly logger = new Logger('CreateSession');

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
    private readonly config: AppConfig,
  ) {}

  /** Authenticates credentials and creates an opaque server session. */
  async create(command: CreateSessionCommand): Promise<CreatedSession> {
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
        if (!membership || membership.role !== context.membership.role) {
          throw new LoginContextChangedError();
        }
        await this.sessions.create({
          id: sessionId,
          tokenHash: session.hash,
          userId: context.user.id,
          workspaceId: context.workspace.id,
          expiresAt: sessionExpiresAt,
        });
        await this.audit.append({
          id: this.identifiers.create(),
          workspaceId: context.workspace.id,
          actorUserId: context.user.id,
          action: 'auth.session.created',
          resourceId: sessionId,
        });
      });
    } catch (error) {
      logSafeFailure(
        this.logger,
        'authentication.session_create_failed',
        error,
      );
      throw new AuthenticationUnavailableError();
    }
    return { ...context, sessionToken: session.raw, sessionExpiresAt };
  }

  /** Maps expected credential failures without exposing infrastructure errors. */
  private async authenticateAndResolveContext(
    command: CreateSessionCommand,
  ): Promise<Omit<CreatedSession, 'sessionToken' | 'sessionExpiresAt'>> {
    try {
      return await this.resolveAuthenticatedContext(command);
    } catch (error) {
      if (
        error instanceof AuthenticationInvalidError ||
        error instanceof WorkspaceSelectionRequiredError
      ) {
        throw error;
      }
      logSafeFailure(
        this.logger,
        'authentication.credential_check_failed',
        error,
      );
      throw new AuthenticationUnavailableError();
    }
  }

  /** Resolves a user and one accessible workspace from credentials. */
  private async resolveAuthenticatedContext(
    command: CreateSessionCommand,
  ): Promise<Omit<CreatedSession, 'sessionToken' | 'sessionExpiresAt'>> {
    const user = await this.users.authenticate({
      email: command.email,
      password: command.password,
    });
    if (!user) throw new AuthenticationInvalidError();
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
    if (!resolved) throw new AuthenticationInvalidError();
    return {
      user,
      workspace: resolved.workspace,
      membership: resolved.membership,
    };
  }
}

/** Signals that authoritative login context changed before commit. */
class LoginContextChangedError extends Error {}
