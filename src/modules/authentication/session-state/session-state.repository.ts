import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../../infrastructure/database/database-context';

/** Hashed token returned so its disposable cache entry can be cleared. */
export type RevokedSessionState = Readonly<{ tokenHash: string }>;

/** Narrow private repository for cross-feature session authority checks. */
@Injectable()
export class SessionStateRepository {
  constructor(private readonly database: DatabaseContext) {}

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

  /** Revokes only sessions whose active tenant matches the membership. */
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
