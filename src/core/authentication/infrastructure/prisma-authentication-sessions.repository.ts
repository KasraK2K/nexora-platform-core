import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../persistence/database-context';
import type {
  AuthenticationSessionsRepository,
  RevokedSession,
  SessionContext,
  SessionRecord,
} from '../application/authentication-sessions';
import type {
  MembershipSessionRevocationsRepository,
  RevokedMembershipSession,
} from '../application/membership-session-revocations';

@Injectable()
export class PrismaAuthenticationSessionsRepository
  implements
    AuthenticationSessionsRepository,
    MembershipSessionRevocationsRepository
{
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

  revokeActiveForMembership(input: {
    userId: string;
    workspaceId: string;
    revokedAt: Date;
  }): Promise<RevokedMembershipSession[]> {
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
