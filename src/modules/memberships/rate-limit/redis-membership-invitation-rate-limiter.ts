import { Injectable } from '@nestjs/common';
import { RedisFixedWindowRateLimiter } from '../../../infrastructure/cache/redis-fixed-window-rate-limiter';
import type { MembershipInvitationRateLimitDecision } from './membership-invitation-rate-limiter';

/** Redis-backed, privacy-preserving limiter for invitation endpoints. */
@Injectable()
export class MembershipInvitationRateLimiter {
  constructor(private readonly windows: RedisFixedWindowRateLimiter) {}

  /** Applies IP, actor/workspace, and optional target-email creation limits. */
  async checkCreate(input: {
    clientIp: string;
    actorUserId: string;
    workspaceId: string;
    normalizedEmail?: string;
  }): Promise<MembershipInvitationRateLimitDecision> {
    const ipDecision = await this.increment(
      `membership-invitation:create:ip:${this.digest(input.clientIp)}`,
      50,
    );
    if (!ipDecision.allowed) return ipDecision;

    const actorDecision = await this.increment(
      `membership-invitation:create:actor-workspace:${this.digest(
        `${input.actorUserId}\0${input.workspaceId}`,
      )}`,
      20,
    );
    if (!actorDecision.allowed || !input.normalizedEmail) {
      return actorDecision;
    }

    return this.increment(
      `membership-invitation:create:target:${this.digest(
        `${input.workspaceId}\0${input.normalizedEmail}`,
      )}`,
      5,
    );
  }

  /** Applies client-IP and authenticated-session acceptance limits. */
  async checkAccept(input: {
    clientIp: string;
    sessionId: string;
  }): Promise<MembershipInvitationRateLimitDecision> {
    const ipDecision = await this.increment(
      `membership-invitation:accept:ip:${this.digest(input.clientIp)}`,
      30,
    );
    if (!ipDecision.allowed) return ipDecision;

    return this.increment(
      `membership-invitation:accept:session:${this.digest(input.sessionId)}`,
      20,
    );
  }

  /** Fails closed when Redis returns an unexpected script result. */
  private async increment(
    key: string,
    limit: number,
  ): Promise<MembershipInvitationRateLimitDecision> {
    return this.windows.increment(key, limit);
  }

  /** HMACs identifying bucket material before it becomes a Redis key. */
  private digest(value: string): string {
    return this.windows.digest(value);
  }
}
