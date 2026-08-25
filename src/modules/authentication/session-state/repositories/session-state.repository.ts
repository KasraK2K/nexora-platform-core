/** Injection token for membership-scoped session-state persistence. */
export const SESSION_STATE_REPOSITORY = Symbol('SESSION_STATE_REPOSITORY');

/** Hashed token returned so its disposable cache entry can be cleared. */
export type RevokedSessionState = Readonly<{ tokenHash: string }>;

/** Persistence boundary for active-context checks and scoped revocation. */
export interface SessionStateRepository {
  /** Verifies one exact active session, user, workspace, and time tuple. */
  hasActiveContext(input: {
    sessionId: string;
    userId: string;
    workspaceId: string;
    now: Date;
  }): Promise<boolean>;

  /** Revokes active sessions scoped to one user-workspace membership. */
  revokeActiveForMembership(input: {
    userId: string;
    workspaceId: string;
    revokedAt: Date;
  }): Promise<RevokedSessionState[]>;
}
