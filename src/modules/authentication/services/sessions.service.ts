import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { PasswordCredentialsService } from '../../identity/password-credentials.service';
import {
  MembershipsService,
  type MembershipRole,
} from '../../memberships/memberships.service';
import { OrganizationsService } from '../../organizations/organizations.service';
import { UsersService } from '../../users/users.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { AppConfig } from '../../../config/app-config';
import { Clock } from '../../../common/application/clock';
import { IdentifierFactory } from '../../../common/application/identifier-factory';
import { TRANSACTION_MANAGER } from '../../../common/application/transaction-manager.port';
import type { TransactionManager } from '../../../common/application/transaction-manager.port';
import { isTransactionWriteConflict } from '../../../common/application/transaction-write-conflict';
import {
  AuthenticationInvalidError,
  AuthenticationRequiredError,
  AuthenticationUnavailableError,
  WorkspaceAccessDeniedError,
  WorkspaceSelectionRequiredError,
  WorkspaceSwitchUnavailableError,
  type WorkspaceSelectionOption,
} from '../domain/registration.errors';
import { AccessibleWorkspaces } from '../application/accessible-workspaces';
import {
  createAuthenticatedRequestContext,
  type AuthenticatedRequestContext,
} from '../application/authenticated-request-context';
import { SessionTokenService } from '../application/session-token.service';
import type {
  RevokedSession,
  SessionRecord,
} from '../repositories/authentication-sessions.repository';
import { SessionStoreService } from '../application/session-store.service';

export type { AuthenticatedRequestContext } from '../application/authenticated-request-context';

/** Credentials and optional workspace selector supplied by a login request. */
export type CreateSessionCommand = {
  email: string;
  password: string;
  workspaceId?: string;
};

/** Login result containing a raw cookie secret and its resolved tenant view. */
export type CreatedSession = {
  user: { id: string; displayName: string };
  organization: { id: string; name: string };
  workspace: { id: string; name: string };
  membership: { role: MembershipRole };
  sessionToken: string;
  sessionExpiresAt: Date;
};

/** Public session view assembled from current user, tenant, and membership state. */
export type CurrentSession = Readonly<{
  user: Readonly<{
    id: string;
    displayName: string;
    status: 'PENDING_VERIFICATION' | 'ACTIVE';
  }>;
  organization: Readonly<{ id: string; name: string }>;
  workspace: Readonly<{ id: string; name: string }>;
  membership: Readonly<{ role: MembershipRole }>;
}>;

/** Trusted authority plus the public session view resolved from one cookie. */
export type ResolvedAuthenticatedRequest = Readonly<{
  context: AuthenticatedRequestContext;
  currentSession: CurrentSession;
}>;

/** Public session state returned after selecting an accessible workspace. */
export type SwitchedWorkspaceSession = Readonly<{
  currentSession: CurrentSession;
  sessionToken: string;
  sessionExpiresAt: Date;
  rotated: boolean;
}>;

/** Owns login, session resolution, revocation, and workspace switching. */
@Injectable()
export class SessionsService {
  private readonly createSessionLogger = new Logger('CreateSession');
  private readonly listSessionWorkspacesLogger = new Logger(
    'ListSessionWorkspaces',
  );
  private readonly switchWorkspaceLogger = new Logger('SwitchWorkspace');

  constructor(
    @Inject(PasswordCredentialsService)
    private readonly passwordIdentities: Pick<
      PasswordCredentialsService,
      'authenticate'
    >,
    @Inject(UsersService)
    private readonly users: Pick<
      UsersService,
      'findActiveByIdentityId' | 'findById'
    >,
    @Inject(MembershipsService)
    private readonly memberships: Pick<MembershipsService, 'find'>,
    private readonly accessibleWorkspaces: AccessibleWorkspaces,
    private readonly sessions: SessionStoreService,
    private readonly organizations: OrganizationsService,
    @Inject(WorkspacesService)
    private readonly workspaces: Pick<WorkspacesService, 'findById'>,
    private readonly auditLog: AuditService,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
    private readonly sessionTokens: SessionTokenService,
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
      this.logFailure(
        this.createSessionLogger,
        'authentication.session_create_failed',
        error,
      );
      throw new AuthenticationUnavailableError();
    }
    await this.sessions.storeCacheBestEffort(
      session.hash,
      { userId: context.user.id, workspaceId: context.workspace.id },
      sessionExpiresAt,
    );
    return { ...context, sessionToken: session.raw, sessionExpiresAt };
  }

  /** Resolves the public view of one current durable session. */
  async getCurrent(rawToken: string | undefined): Promise<CurrentSession> {
    return (await this.resolveAuthenticatedRequest(rawToken)).currentSession;
  }

  /** Resolves immutable server authority and its public current-session view. */
  async resolveAuthenticatedRequest(
    rawToken: string | undefined,
  ): Promise<ResolvedAuthenticatedRequest> {
    const tokenHash = this.sessionTokens.hashIfValid(rawToken);
    if (!tokenHash) throw new AuthenticationRequiredError();
    let authenticated: ResolvedAuthenticatedRequest | undefined;
    try {
      authenticated = await this.resolveCurrentSession(tokenHash);
    } catch {
      throw new AuthenticationUnavailableError();
    }
    if (!authenticated) {
      await this.sessions.removeCacheBestEffort(tokenHash);
      throw new AuthenticationRequiredError();
    }
    return authenticated;
  }

  /** Lists bounded workspace choices for the trusted actor. */
  async listWorkspaces(
    actorUserId: string,
  ): Promise<WorkspaceSelectionOption[]> {
    try {
      return await this.accessibleWorkspaces.listForUser(actorUserId);
    } catch (error) {
      this.logFailure(
        this.listSessionWorkspacesLogger,
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
          if (!revoked || revoked.id !== session.id)
            throw new AuthenticationRequiredError();
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
        if (attempt === 0 && isTransactionWriteConflict(error)) continue;
        if (
          error instanceof AuthenticationRequiredError ||
          error instanceof WorkspaceAccessDeniedError
        ) {
          throw error;
        }
        this.logFailure(
          this.switchWorkspaceLogger,
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

  /** Idempotently revokes the presented session. */
  async revokeCurrent(rawToken: string | undefined): Promise<void> {
    const tokenHash = this.sessionTokens.hashIfValid(rawToken);
    if (!tokenHash) return;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await this.transactions.execute(async () => {
          const revoked = await this.sessions.revokeByTokenHash(
            tokenHash,
            this.clock.now(),
          );
          if (!revoked) return;
          await this.auditLog.append({
            id: this.identifiers.create(),
            workspaceId: revoked.activeWorkspaceId,
            actorUserId: revoked.userId,
            action: 'auth.session.revoked',
            resourceId: revoked.id,
          });
        });
        break;
      } catch (error) {
        if (attempt === 0 && isTransactionWriteConflict(error)) continue;
        throw new AuthenticationUnavailableError();
      }
    }
    await this.sessions.removeCacheBestEffort(tokenHash);
  }

  /** Revokes every durable session owned by the authenticated user. */
  async revokeAll(rawToken: string | undefined): Promise<void> {
    const tokenHash = this.sessionTokens.hashIfValid(rawToken);
    if (!tokenHash) throw new AuthenticationRequiredError();
    let revokedSessions: RevokedSession[];
    try {
      revokedSessions = await this.transactions.execute(async () => {
        const now = this.clock.now();
        const current = await this.sessions.findByTokenHash(tokenHash);
        if (
          !current ||
          current.revokedAt ||
          current.expiresAt.getTime() <= now.getTime()
        ) {
          throw new AuthenticationRequiredError();
        }
        const revoked = await this.sessions.revokeAllForUser(
          current.userId,
          now,
        );
        const workspaceIds = new Set(
          revoked.map((session) => session.activeWorkspaceId),
        );
        for (const workspaceId of workspaceIds) {
          await this.auditLog.append({
            id: this.identifiers.create(),
            workspaceId,
            actorUserId: current.userId,
            action: 'auth.sessions.revoked_all',
            resourceId: current.userId,
          });
        }
        return revoked;
      });
    } catch (error) {
      if (error instanceof AuthenticationRequiredError) throw error;
      throw new AuthenticationUnavailableError();
    }
    await Promise.all(
      revokedSessions.map((session) =>
        this.sessions.removeCacheBestEffort(session.tokenHash),
      ),
    );
  }

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
      this.logFailure(
        this.createSessionLogger,
        'authentication.credential_check_failed',
        error,
      );
      throw new AuthenticationUnavailableError();
    }
  }

  private async resolveAuthenticatedContext(
    command: CreateSessionCommand,
  ): Promise<Omit<CreatedSession, 'sessionToken' | 'sessionExpiresAt'>> {
    const identity = await this.passwordIdentities.authenticate({
      email: command.email,
      password: command.password,
    });
    if (!identity) throw new AuthenticationInvalidError();
    const user = await this.users.findActiveByIdentityId(identity.identityId);
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
      organization: resolved.organization,
      workspace: resolved.workspace,
      membership: resolved.membership,
    };
  }

  private async resolveCurrentSession(
    tokenHash: string,
  ): Promise<ResolvedAuthenticatedRequest | undefined> {
    const session = await this.sessions.findByTokenHash(tokenHash);
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      return undefined;
    }
    const [user, workspace, membership] = await Promise.all([
      this.users.findById(session.userId),
      this.workspaces.findById(session.activeWorkspaceId),
      this.memberships.find({
        workspaceId: session.activeWorkspaceId,
        userId: session.userId,
      }),
    ]);
    if (!user || !workspace || !membership) return undefined;
    const organization = await this.organizations.findById(
      workspace.organizationId,
    );
    if (!organization) return undefined;
    await this.sessions.refreshCacheBestEffort(
      tokenHash,
      { userId: user.id, workspaceId: workspace.id },
      session.expiresAt,
    );
    return Object.freeze({
      context: createAuthenticatedRequestContext({
        sessionId: session.id,
        actorUserId: user.id,
        userStatus: user.status,
        organizationId: organization.id,
        workspaceId: workspace.id,
      }),
      currentSession: Object.freeze({
        user: Object.freeze({ ...user }),
        organization: Object.freeze({ ...organization }),
        workspace: Object.freeze({ id: workspace.id, name: workspace.name }),
        membership: Object.freeze({ role: membership.role }),
      }),
    });
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

/** Signals that authoritative login context changed before session commit. */
class LoginContextChangedError extends Error {}

/** Extracts only a string error code that is safe for structured logs. */
function readSafeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error))
    return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}
