import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import type {
  MembershipInvitationRateLimitDecision,
  MembershipInvitationRateLimiterPort,
} from '../application/membership-invitation-rate-limiter.port';

/** Fixed window used for every invitation throttling bucket. */
const WINDOW_SECONDS = 15 * 60;

/** Atomically increments a Redis bucket and returns its count and remaining TTL. */
const SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}
`;

/** Redis-backed, privacy-preserving limiter for invitation endpoints. */
@Injectable()
export class MembershipInvitationRateLimiter implements MembershipInvitationRateLimiterPort {
  constructor(
    private readonly redis: RedisService,
    private readonly config: AppConfig,
  ) {}

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
    const result = await this.redis.client.eval(SCRIPT, {
      keys: [key],
      arguments: [WINDOW_SECONDS.toString()],
    });
    if (!Array.isArray(result) || result.length !== 2) {
      return { allowed: false, retryAfterSeconds: WINDOW_SECONDS };
    }
    return {
      allowed: Number(result[0]) <= limit,
      retryAfterSeconds: Math.max(1, Number(result[1])),
    };
  }

  /** HMACs identifying bucket material before it becomes a Redis key. */
  private digest(value: string): string {
    return createHmac('sha256', this.config.rateLimitKeySecret)
      .update(value, 'utf8')
      .digest('hex');
  }
}
