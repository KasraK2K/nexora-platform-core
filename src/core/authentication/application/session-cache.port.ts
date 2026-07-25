export const SESSION_CACHE = Symbol('SESSION_CACHE');

export interface SessionCachePort {
  store(
    tokenHash: string,
    session: { userId: string; workspaceId: string },
    expiresAt: Date,
  ): Promise<void>;
  exists(tokenHash: string): Promise<boolean>;
  remove(tokenHash: string): Promise<void>;
}
