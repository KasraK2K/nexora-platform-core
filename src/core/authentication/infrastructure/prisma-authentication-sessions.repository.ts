import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../persistence/database-context';
import type {
  AuthenticationSessionsRepository,
  RevokedSession,
  SessionContext,
  SessionRecord,
} from '../application/authentication-sessions';

@Injectable()
export class PrismaAuthenticationSessionsRepository implements AuthenticationSessionsRepository {
  constructor(private readonly database: DatabaseContext) {}

  async create(input: {
    id: string;
    tokenHash: string;
    userId: string;
    activeWorkspaceId: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.database.client.session.create({ data: input });
  }

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

  findLatestForUser(userId: string): Promise<SessionContext | null> {
    return this.database.client.session.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { userId: true, activeWorkspaceId: true },
    });
  }

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
