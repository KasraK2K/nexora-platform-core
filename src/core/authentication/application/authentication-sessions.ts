import { Inject, Injectable } from '@nestjs/common';

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
  /** Inserts a session containing only the opaque token hash and durable context. */
  create(input: {
    id: string;
    tokenHash: string;
    userId: string;
    activeWorkspaceId: string;
    expiresAt: Date;
  }): Promise<void>;
  /** Finds the authoritative session row for a token hash. */
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  /** Finds the latest session still associated with an active membership. */
  findLatestForUser(userId: string): Promise<SessionContext | null>;
  /** Atomically revokes one still-active session and returns its audit context. */
  revokeByTokenHash(
    tokenHash: string,
    revokedAt: Date,
  ): Promise<RevokedSession | null>;
  /** Atomically revokes every still-active session for a user. */
  revokeAllForUser(userId: string, revokedAt: Date): Promise<RevokedSession[]>;
}

/** Application-facing gateway to Authentication-owned session persistence. */
@Injectable()
export class AuthenticationSessions {
  constructor(
    @Inject(AUTHENTICATION_SESSIONS_REPOSITORY)
    private readonly repository: AuthenticationSessionsRepository,
  ) {}

  /** Persists a hashed opaque session; the surrounding use case owns the transaction. */
  create(input: {
    id: string;
    tokenHash: string;
    userId: string;
    activeWorkspaceId: string;
    expiresAt: Date;
  }): Promise<void> {
    return this.repository.create(input);
  }

  /** Looks up the authoritative session row for a hashed token. */
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return this.repository.findByTokenHash(tokenHash);
  }

  /** Finds the most recently created session still linked to an active membership. */
  findLatestForUser(userId: string): Promise<SessionContext | null> {
    return this.repository.findLatestForUser(userId);
  }

  /** Atomically revokes one still-active session and returns its audit context. */
  revokeByTokenHash(
    tokenHash: string,
    revokedAt: Date,
  ): Promise<RevokedSession | null> {
    return this.repository.revokeByTokenHash(tokenHash, revokedAt);
  }

  /** Atomically revokes every still-active session for a user. */
  revokeAllForUser(userId: string, revokedAt: Date): Promise<RevokedSession[]> {
    return this.repository.revokeAllForUser(userId, revokedAt);
  }
}
