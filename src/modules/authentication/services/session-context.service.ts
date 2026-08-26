import { Injectable } from '@nestjs/common';
import { MembershipsService } from '../../memberships/memberships.service';
import { OrganizationsService } from '../../organizations/organizations.service';
import { UsersService } from '../../users/users.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import {
  AuthenticationRequiredError,
  AuthenticationUnavailableError,
} from '../errors/authentication.errors';
import { createAuthenticatedRequestContext } from '../security/authenticated-request-context';
import { OpaqueTokenService } from '../../../common/security/opaque-token.service';
import { SessionStoreService } from '../services/session-store.service';
import type {
  CurrentSession,
  ResolvedAuthenticatedRequest,
} from './session.types';

export type { AuthenticatedRequestContext } from '../security/authenticated-request-context';
export type {
  CurrentSession,
  ResolvedAuthenticatedRequest,
} from './session.types';

/** Resolves authoritative session context and its public tenant view. */
@Injectable()
export class SessionContextService {
  constructor(
    private readonly users: UsersService,
    private readonly memberships: MembershipsService,
    private readonly sessions: SessionStoreService,
    private readonly organizations: OrganizationsService,
    private readonly workspaces: WorkspacesService,
    private readonly sessionTokens: OpaqueTokenService,
  ) {}

  /** Resolves the public view of one current durable session. */
  async getCurrent(rawToken: string | undefined): Promise<CurrentSession> {
    return (await this.resolveAuthenticatedRequest(rawToken)).currentSession;
  }

  /** Resolves immutable server authority and its public session view. */
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

  /** Loads every public session component from authoritative storage. */
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
}
