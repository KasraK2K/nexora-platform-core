import { Inject, Injectable } from '@nestjs/common';
import { SESSION_CACHE } from './session-cache.port';
import type { SessionCachePort } from './session-cache.port';

/** Injection token for membership-scoped session revocation persistence. */
export const MEMBERSHIP_SESSION_REVOCATIONS_REPOSITORY = Symbol(
  'MEMBERSHIP_SESSION_REVOCATIONS_REPOSITORY',
);

/** Hashed token returned so its disposable cache entry can be cleared. */
export type RevokedMembershipSession = Readonly<{ tokenHash: string }>;

/**
 * Narrow contract used by Memberships to verify and revoke sessions only for
 * the trusted user/workspace pair involved in a membership operation.
 */
export interface MembershipSessionRevocationsRepository {
  /** Verifies an exact active session, user, workspace, and time tuple. */
  hasActiveContext(input: {
    sessionId: string;
    userId: string;
    workspaceId: string;
    now: Date;
  }): Promise<boolean>;
  /** Revokes active sessions scoped to the affected user-workspace membership. */
  revokeActiveForMembership(input: {
    userId: string;
    workspaceId: string;
    revokedAt: Date;
  }): Promise<RevokedMembershipSession[]>;
}

/** Coordinates durable membership-scoped revocation with cache cleanup. */
@Injectable()
export class MembershipSessionRevocations {
  constructor(
    @Inject(MEMBERSHIP_SESSION_REVOCATIONS_REPOSITORY)
    private readonly repository: MembershipSessionRevocationsRepository,
    @Inject(SESSION_CACHE) private readonly sessionCache: SessionCachePort,
  ) {}

  /** Checks that a session still authorizes this exact user and workspace. */
  hasActiveContext(input: {
    sessionId: string;
    userId: string;
    workspaceId: string;
    now: Date;
  }): Promise<boolean> {
    return this.repository.hasActiveContext(input);
  }

  /** Revokes active sessions scoped to one membership inside the caller's transaction. */
  revokeActiveForMembership(input: {
    userId: string;
    workspaceId: string;
    revokedAt: Date;
  }): Promise<RevokedMembershipSession[]> {
    return this.repository.revokeActiveForMembership(input);
  }

  /**
   * Removes cache entries after durable revocation. Cache failures are ignored
   * because PostgreSQL remains the source of truth.
   */
  async clearCachesBestEffort(
    sessions: readonly RevokedMembershipSession[],
  ): Promise<void> {
    await Promise.all(
      sessions.map((session) =>
        this.sessionCache.remove(session.tokenHash).catch(() => undefined),
      ),
    );
  }
}
