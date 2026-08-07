import { Inject, Injectable } from '@nestjs/common';
import { Memberships } from '../../memberships/application/memberships';
import { Organizations } from '../../organizations/application/organizations';
import { Users } from '../../users/application/users';
import { Workspaces } from '../../workspaces/application/workspaces';
import {
  AuthenticationRequiredError,
  AuthenticationUnavailableError,
} from '../domain/registration.errors';
import { AuthenticationSessions } from './authentication-sessions';
import { SESSION_CACHE } from './session-cache.port';
import type { SessionCachePort } from './session-cache.port';
import { SessionTokenService } from './session-token.service';

const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type CurrentSession = {
  user: { id: string; displayName: string };
  organization: { id: string; name: string };
  workspace: { id: string; name: string };
  membership: { role: 'OWNER' };
};

@Injectable()
export class GetCurrentSession {
  constructor(
    private readonly sessions: AuthenticationSessions,
    private readonly users: Users,
    private readonly organizations: Organizations,
    private readonly workspaces: Workspaces,
    private readonly memberships: Memberships,
    @Inject(SESSION_CACHE) private readonly sessionCache: SessionCachePort,
    private readonly sessionTokens: SessionTokenService,
  ) {}

  async execute(rawToken: string | undefined): Promise<CurrentSession> {
    if (!rawToken || !SESSION_TOKEN_PATTERN.test(rawToken)) {
      throw new AuthenticationRequiredError();
    }

    const tokenHash = this.sessionTokens.hash(rawToken);
    let currentSession: CurrentSession | undefined;
    try {
      currentSession = await this.resolveCurrentSession(tokenHash);
    } catch {
      throw new AuthenticationUnavailableError();
    }

    if (!currentSession) {
      await this.removeCacheBestEffort(tokenHash);
      throw new AuthenticationRequiredError();
    }

    return currentSession;
  }

  private async resolveCurrentSession(
    tokenHash: string,
  ): Promise<CurrentSession | undefined> {
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
    if (!user || !workspace || !membership || membership.role !== 'OWNER') {
      return undefined;
    }

    const organization = await this.organizations.findById(
      workspace.organizationId,
    );
    if (!organization) {
      return undefined;
    }

    await this.refreshCacheBestEffort(
      tokenHash,
      { userId: user.id, workspaceId: workspace.id },
      session.expiresAt,
    );

    return {
      user,
      organization,
      workspace: { id: workspace.id, name: workspace.name },
      membership: { role: 'OWNER' },
    };
  }

  private async refreshCacheBestEffort(
    tokenHash: string,
    session: { userId: string; workspaceId: string },
    expiresAt: Date,
  ): Promise<void> {
    try {
      if (!(await this.sessionCache.exists(tokenHash))) {
        await this.sessionCache.store(tokenHash, session, expiresAt);
      }
    } catch {
      // PostgreSQL is authoritative; a disposable cache outage must not revoke a valid session.
    }
  }

  private async removeCacheBestEffort(tokenHash: string): Promise<void> {
    try {
      await this.sessionCache.remove(tokenHash);
    } catch {
      // PostgreSQL is authoritative; cache cleanup must not mask an invalid session.
    }
  }
}
