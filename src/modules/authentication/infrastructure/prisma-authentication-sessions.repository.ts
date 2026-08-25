import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../../infrastructure/database/database-context';
import type {
  AuthenticationSessionsRepository,
  RevokedSession,
  SessionContext,
  SessionRecord,
} from '../repositories/authentication-sessions.repository';
import type {
  RevokedSessionState,
  SessionStateRepository,
} from '../session-state/repositories/session-state.repository';

/** Prisma adapter for Authentication-owned durable session state. */
@Injectable()
export class PrismaAuthenticationSessionsRepository
  implements AuthenticationSessionsRepository, SessionStateRepository
{
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

  /** Confirms an exact unexpired session, user, and workspace tuple. */
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
          activeWorkspaceId: input.workspaceId,
          revokedAt: null,
          expiresAt: { gt: input.now },
        },
      })) === 1
    );
  }

  /** Revokes only sessions whose active tenant matches the affected membership. */
  revokeActiveForMembership(input: {
    userId: string;
    workspaceId: string;
    revokedAt: Date;
  }): Promise<RevokedSessionState[]> {
    return this.database.client.session.updateManyAndReturn({
      where: {
        userId: input.userId,
        activeWorkspaceId: input.workspaceId,
        revokedAt: null,
      },
      data: { revokedAt: input.revokedAt },
      select: { tokenHash: true },
    });
  }
}

const revokedSessionSelect = {
  id: true,
  tokenHash: true,
  userId: true,
  activeWorkspaceId: true,
} as const;
