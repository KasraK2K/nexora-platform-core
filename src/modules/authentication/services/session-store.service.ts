import { Inject, Injectable } from '@nestjs/common';
import { SESSION_CACHE } from '../cache/session-cache';
import type { SessionCachePort } from '../cache/session-cache';
import {
  AuthenticationSessionsRepository,
  type RevokedSession,
  type SessionContext,
  type SessionRecord,
} from '../repositories/authentication-sessions.repository';

/**
 * Keeps Authentication-only durable session and cache capabilities behind a
 * provider that is never exported from AuthenticationModule.
 */
@Injectable()
export class SessionStoreService {
  constructor(
    private readonly sessions: AuthenticationSessionsRepository,
    @Inject(SESSION_CACHE) private readonly sessionCache: SessionCachePort,
  ) {}

  /** Persists a hashed opaque session in the caller-owned transaction. */
  create(input: {
    id: string;
    tokenHash: string;
    userId: string;
    activeWorkspaceId: string;
    expiresAt: Date;
  }): Promise<void> {
    return this.sessions.create(input);
  }

  /** Finds the authoritative durable session by opaque-token hash. */
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return this.sessions.findByTokenHash(tokenHash);
  }

  /** Finds the latest active membership-backed context for one user. */
  findLatestForUser(userId: string): Promise<SessionContext | null> {
    return this.sessions.findLatestForUser(userId);
  }

  /** Atomically revokes one active token hash. */
  revokeByTokenHash(
    tokenHash: string,
    revokedAt: Date,
  ): Promise<RevokedSession | null> {
    return this.sessions.revokeByTokenHash(tokenHash, revokedAt);
  }

  /** Atomically revokes all active sessions for one user. */
  revokeAllForUser(userId: string, revokedAt: Date): Promise<RevokedSession[]> {
    return this.sessions.revokeAllForUser(userId, revokedAt);
  }

  /** Stores disposable session lookup context without weakening PostgreSQL authority. */
  storeCacheBestEffort(
    tokenHash: string,
    value: { userId: string; workspaceId: string },
    expiresAt: Date,
  ): Promise<void> {
    return this.sessionCache
      .store(tokenHash, value, expiresAt)
      .catch(() => undefined);
  }

  /** Refreshes cache only when the durable session has no disposable lookup entry. */
  async refreshCacheBestEffort(
    tokenHash: string,
    value: { userId: string; workspaceId: string },
    expiresAt: Date,
  ): Promise<void> {
    try {
      if (!(await this.sessionCache.exists(tokenHash))) {
        await this.sessionCache.store(tokenHash, value, expiresAt);
      }
    } catch {
      // PostgreSQL remains authoritative during cache outages.
    }
  }

  /** Removes one disposable session cache entry on a best-effort basis. */
  removeCacheBestEffort(tokenHash: string): Promise<void> {
    return this.sessionCache.remove(tokenHash).catch(() => undefined);
  }
}
