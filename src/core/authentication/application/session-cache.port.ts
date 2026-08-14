/** Injection token for the disposable session lookup cache. */
export const SESSION_CACHE = Symbol('SESSION_CACHE');

/**
 * Caches hashed-token lookups. PostgreSQL remains authoritative, so callers
 * must treat failures from this port as cache failures rather than session
 * revocation decisions.
 */
export interface SessionCachePort {
  /** Stores a hashed-token lookup until the durable session's absolute expiry. */
  store(
    tokenHash: string,
    session: { userId: string; workspaceId: string },
    expiresAt: Date,
  ): Promise<void>;
  /** Reports whether a cache entry exists for the supplied token hash. */
  exists(tokenHash: string): Promise<boolean>;
  /** Removes the cache entry for the supplied token hash. */
  remove(tokenHash: string): Promise<void>;
}
