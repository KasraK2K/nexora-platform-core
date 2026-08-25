import { Inject, Injectable } from '@nestjs/common';
import { SESSION_CACHE } from '../application/session-cache.port';
import type { SessionCachePort } from '../application/session-cache.port';
import {
  SESSION_STATE_REPOSITORY,
  type RevokedSessionState,
  type SessionStateRepository,
} from './repositories/session-state.repository';

export type { RevokedSessionState } from './repositories/session-state.repository';

/** Coordinates durable membership-scoped revocation with cache cleanup. */
@Injectable()
export class SessionStateService {
  constructor(
    @Inject(SESSION_STATE_REPOSITORY)
    private readonly repository: SessionStateRepository,
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
  }): Promise<RevokedSessionState[]> {
    return this.repository.revokeActiveForMembership(input);
  }

  /**
   * Removes cache entries after durable revocation. Cache failures are ignored
   * because PostgreSQL remains the source of truth.
   */
  async clearCachesBestEffort(
    sessions: readonly RevokedSessionState[],
  ): Promise<void> {
    await Promise.all(
      sessions.map((session) =>
        this.sessionCache.remove(session.tokenHash).catch(() => undefined),
      ),
    );
  }
}
