import { Injectable } from '@nestjs/common';
import { MembershipsService } from '../../memberships/memberships.service';
import { UsersService } from '../../users/users.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import {
  AuthenticationRequiredError,
  AuthenticationUnavailableError,
} from '../errors/authentication.errors';
import { createAuthenticatedRequestContext } from '../security/authenticated-request-context';
import { OpaqueTokenService } from '../../../common/security/opaque-token.service';
import { SessionsService } from '../../sessions/sessions.service';
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
    private readonly sessions: SessionsService,
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
      this.workspaces.findById(session.workspaceId),
      this.memberships.find({
        workspaceId: session.workspaceId,
        userId: session.userId,
      }),
    ]);
    if (!user || !workspace || !membership) return undefined;
    return Object.freeze({
      context: createAuthenticatedRequestContext({
        sessionId: session.id,
        actorUserId: user.id,
        userStatus: user.status,
        workspaceId: workspace.id,
      }),
      currentSession: Object.freeze({
        user: Object.freeze({ ...user }),
        workspace: Object.freeze({ id: workspace.id, name: workspace.name }),
        membership: Object.freeze({ role: membership.role }),
      }),
    });
  }
}
