import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../../infrastructure/database/database-context';

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

/** Private repository for Authentication-owned durable session state. */
@Injectable()
export class AuthenticationSessionsRepository {
  constructor(private readonly database: DatabaseContext) {}

  /** Inserts a session through the current database or transaction client. */
  async create(input: {
    id: string;
    tokenHash: string;
    userId: string;
    activeWorkspaceId: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.database.client.session.create({ data: input });
  }

  /** Selects authoritative session fields by unique token hash. */
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return this.database.client.session.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        tokenHash: true,
        userId: true,
        activeWorkspaceId: true,
        expiresAt: true,
        revokedAt: true,
      },
    });
  }

  /** Finds the latest session whose backing membership has not been removed. */
  findLatestForUser(userId: string): Promise<SessionContext | null> {
    return this.database.client.session.findFirst({
      where: { userId, membership: { removedAt: null } },
      orderBy: { createdAt: 'desc' },
      select: { userId: true, activeWorkspaceId: true },
    });
  }

  /** Atomically marks one still-active session revoked and returns its audit fields. */
  async revokeByTokenHash(
    tokenHash: string,
    revokedAt: Date,
  ): Promise<RevokedSession | null> {
    const sessions = await this.database.client.session.updateManyAndReturn({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt },
      select: revokedSessionSelect,
    });
    return sessions[0] ?? null;
  }

  /** Atomically revokes all still-active sessions for one user. */
  revokeAllForUser(userId: string, revokedAt: Date): Promise<RevokedSession[]> {
    return this.database.client.session.updateManyAndReturn({
      where: { userId, revokedAt: null },
      data: { revokedAt },
      select: revokedSessionSelect,
    });
  }
}

const revokedSessionSelect = {
  id: true,
  tokenHash: true,
  userId: true,
  activeWorkspaceId: true,
} as const;
