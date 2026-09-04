import { Injectable } from '@nestjs/common';
import { SessionsRepository } from './sessions.repository';
import {
  type RevokedSession,
  type SessionContext,
  type SessionRecord,
} from './sessions.types';

export type {
  RevokedSession,
  SessionContext,
  SessionRecord,
} from './sessions.types';

/** Public session capability shared by authentication and tenant workflows. */
@Injectable()
export class SessionsService {
  constructor(private readonly sessions: SessionsRepository) {}

  /** Creates a hashed opaque session inside the caller-owned transaction. */
  create(input: {
    id: string;
    tokenHash: string;
    userId: string;
    workspaceId: string;
    expiresAt: Date;
  }): Promise<void> {
    return this.sessions.create(input);
  }

  /** Finds the authoritative durable session by token hash. */
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return this.sessions.findByTokenHash(tokenHash);
  }

  /** Finds a user's latest active membership-backed session context. */
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

  /** Atomically revokes every active session for one user. */
  revokeAllForUser(userId: string, revokedAt: Date): Promise<RevokedSession[]> {
    return this.sessions.revokeAllForUser(userId, revokedAt);
  }

  /** Checks the exact session tuple captured by route admission. */
  hasActiveContext(input: {
    sessionId: string;
    userId: string;
    workspaceId: string;
    now: Date;
  }): Promise<boolean> {
    return this.sessions.hasActiveContext(input);
  }

  /** Revokes active sessions scoped to one removed membership. */
  revokeActiveForMembership(input: {
    userId: string;
    workspaceId: string;
    revokedAt: Date;
  }): Promise<RevokedSession[]> {
    return this.sessions.revokeActiveForMembership(input);
  }
}
