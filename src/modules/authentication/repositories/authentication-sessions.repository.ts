/** Injection token for the durable authentication-session repository. */
export const AUTHENTICATION_SESSIONS_REPOSITORY = Symbol(
  'AUTHENTICATION_SESSIONS_REPOSITORY',
);

/** Durable session state addressed by a hash of the opaque cookie secret. */
export type SessionRecord = {
  id: string;
  tokenHash: string;
  userId: string;
  activeWorkspaceId: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

/** Session fields needed after an atomic revocation. */
export type RevokedSession = Pick<
  SessionRecord,
  'id' | 'tokenHash' | 'userId' | 'activeWorkspaceId'
>;

/** Minimal workspace context recovered for a user's latest session. */
export type SessionContext = Pick<
  SessionRecord,
  'userId' | 'activeWorkspaceId'
>;

/** Persistence contract owned by Authentication for session lifecycle state. */
export interface AuthenticationSessionsRepository {
  /** Inserts a durable session containing only the opaque token hash. */
  create(input: {
    id: string;
    tokenHash: string;
    userId: string;
    activeWorkspaceId: string;
    expiresAt: Date;
  }): Promise<void>;
  /** Finds the authoritative session row for a token hash. */
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  /** Finds the latest session still backed by an active membership. */
  findLatestForUser(userId: string): Promise<SessionContext | null>;
  /** Atomically revokes one active session and returns its audit context. */
  revokeByTokenHash(
    tokenHash: string,
    revokedAt: Date,
  ): Promise<RevokedSession | null>;
  /** Atomically revokes every active session owned by one user. */
  revokeAllForUser(userId: string, revokedAt: Date): Promise<RevokedSession[]>;
}
