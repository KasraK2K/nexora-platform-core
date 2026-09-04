import { Injectable } from '@nestjs/common';
import type { RateLimitDecision } from '../../../common/http/request-rate-limit';
import { RedisFixedWindowRateLimiter } from '../../../infrastructure/cache/redis-fixed-window-rate-limiter';

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
  }): Promise<RateLimitDecision> {
    const ipDecision = await this.windows.increment(
      `membership-invitation:create:ip:${this.windows.digest(input.clientIp)}`,
      50,
    );
    if (!ipDecision.allowed) return ipDecision;

    const actorDecision = await this.windows.increment(
      `membership-invitation:create:actor-workspace:${this.windows.digest(
        `${input.actorUserId}\0${input.workspaceId}`,
      )}`,
      20,
    );
    if (!actorDecision.allowed || !input.normalizedEmail) {
      return actorDecision;
    }

    return this.windows.increment(
      `membership-invitation:create:target:${this.windows.digest(
        `${input.workspaceId}\0${input.normalizedEmail}`,
      )}`,
      5,
    );
  }

  /** Applies client-IP and authenticated-session acceptance limits. */
  async checkAccept(input: {
    clientIp: string;
    sessionId: string;
  }): Promise<RateLimitDecision> {
    const ipDecision = await this.windows.increment(
      `membership-invitation:accept:ip:${this.windows.digest(input.clientIp)}`,
      30,
    );
    if (!ipDecision.allowed) return ipDecision;

    return this.windows.increment(
      `membership-invitation:accept:session:${this.windows.digest(input.sessionId)}`,
      20,
    );
  }
}
