import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../infrastructure/database/database-context';

/** PostgreSQL session state addressed by a hash of the opaque cookie secret. */
export type SessionRecord = Readonly<{
  id: string;
  tokenHash: string;
  userId: string;
  workspaceId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}>;

/** Session fields returned after atomic revocation. */
export type RevokedSession = Pick<
  SessionRecord,
  'id' | 'tokenHash' | 'userId' | 'workspaceId'
>;

/** Minimal workspace attribution recovered from a membership-backed session. */
export type SessionContext = Pick<SessionRecord, 'userId' | 'workspaceId'>;

/** Private concrete repository for the Session table. */
@Injectable()
export class SessionsRepository {
  constructor(private readonly database: DatabaseContext) {}

  /** Inserts a session through the current database or transaction client. */
  async create(input: {
    id: string;
    tokenHash: string;
    userId: string;
    workspaceId: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.database.client.session.create({ data: input });
  }

  /** Finds one authoritative session by unique token hash. */
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return this.database.client.session.findUnique({
      where: { tokenHash },
      select: sessionSelect,
    });
  }

  /** Finds the latest session whose workspace membership is still active. */
  findLatestForUser(userId: string): Promise<SessionContext | null> {
    return this.database.client.session.findFirst({
      where: { userId, membership: { removedAt: null } },
      orderBy: { createdAt: 'desc' },
      select: { userId: true, workspaceId: true },
    });
  }

  /** Atomically revokes one active session and returns its audit fields. */
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

  /** Atomically revokes every active session for one user. */
  revokeAllForUser(userId: string, revokedAt: Date): Promise<RevokedSession[]> {
    return this.database.client.session.updateManyAndReturn({
      where: { userId, revokedAt: null },
      data: { revokedAt },
      select: revokedSessionSelect,
    });
  }

  /** Confirms one exact unexpired session, user, and workspace tuple. */
  async hasActiveContext(input: {
    sessionId: string;
    userId: string;
    workspaceId: string;
    now: Date;
  }): Promise<boolean> {
    return (
      (await this.database.client.session.count({
        where: {
          id: input.sessionId,
          userId: input.userId,
          workspaceId: input.workspaceId,
          revokedAt: null,
          expiresAt: { gt: input.now },
        },
      })) === 1
    );
  }

  /** Revokes only sessions whose current tenant matches one membership. */
  revokeActiveForMembership(input: {
    userId: string;
    workspaceId: string;
    revokedAt: Date;
  }): Promise<RevokedSession[]> {
    return this.database.client.session.updateManyAndReturn({
      where: {
        userId: input.userId,
        workspaceId: input.workspaceId,
        revokedAt: null,
      },
      data: { revokedAt: input.revokedAt },
      select: revokedSessionSelect,
    });
  }
}

const sessionSelect = {
  id: true,
  tokenHash: true,
  userId: true,
  workspaceId: true,
  expiresAt: true,
  revokedAt: true,
} as const;

const revokedSessionSelect = {
  id: true,
  tokenHash: true,
  userId: true,
  workspaceId: true,
} as const;
