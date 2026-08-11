import { Inject, Injectable } from '@nestjs/common';
import { SESSION_CACHE } from './session-cache.port';
import type { SessionCachePort } from './session-cache.port';

export const MEMBERSHIP_SESSION_REVOCATIONS_REPOSITORY = Symbol(
  'MEMBERSHIP_SESSION_REVOCATIONS_REPOSITORY',
);

export type RevokedMembershipSession = Readonly<{ tokenHash: string }>;

export interface MembershipSessionRevocationsRepository {
  hasActiveContext(input: {
    sessionId: string;
    userId: string;
    workspaceId: string;
    now: Date;
  }): Promise<boolean>;
  revokeActiveForMembership(input: {
    userId: string;
    workspaceId: string;
    revokedAt: Date;
  }): Promise<RevokedMembershipSession[]>;
}

@Injectable()
export class MembershipSessionRevocations {
  constructor(
    @Inject(MEMBERSHIP_SESSION_REVOCATIONS_REPOSITORY)
    private readonly repository: MembershipSessionRevocationsRepository,
    @Inject(SESSION_CACHE) private readonly sessionCache: SessionCachePort,
  ) {}

  hasActiveContext(input: {
    sessionId: string;
    userId: string;
    workspaceId: string;
    now: Date;
  }): Promise<boolean> {
    return this.repository.hasActiveContext(input);
  }

  revokeActiveForMembership(input: {
    userId: string;
    workspaceId: string;
    revokedAt: Date;
  }): Promise<RevokedMembershipSession[]> {
    return this.repository.revokeActiveForMembership(input);
  }

  async clearCachesBestEffort(
    sessions: readonly RevokedMembershipSession[],
  ): Promise<void> {
    await Promise.all(
      sessions.map((session) =>
        this.sessionCache.remove(session.tokenHash).catch(() => undefined),
      ),
    );
  }
}
