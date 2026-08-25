import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import type {
  MembershipOwnershipTransferRateLimitDecision,
  MembershipOwnershipTransferRateLimiterPort,
} from '../application/membership-ownership-transfer-rate-limiter.port';

/** Fixed window used for ownership-transfer throttling buckets. */
const WINDOW_SECONDS = 15 * 60;

/** Atomically increments a Redis bucket and returns its count and remaining TTL. */
const SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}
`;

/** Redis-backed, privacy-preserving limiter for ownership transfer attempts. */
@Injectable()
export class MembershipOwnershipTransferRateLimiter implements MembershipOwnershipTransferRateLimiterPort {
  constructor(
    private readonly redis: RedisService,
    private readonly config: AppConfig,
  ) {}

  /** Applies client-IP and authenticated session/workspace limits. */
  async check(input: {
    clientIp: string;
    sessionId: string;
    workspaceId: string;
  }): Promise<MembershipOwnershipTransferRateLimitDecision> {
    const ipDecision = await this.increment(
      `membership-ownership:transfer:ip:${this.digest(input.clientIp)}`,
      20,
    );
    if (!ipDecision.allowed) return ipDecision;

    return this.increment(
      `membership-ownership:transfer:session-workspace:${this.digest(
        `${input.sessionId}\0${input.workspaceId}`,
      )}`,
      5,
    );
  }

  /** Fails closed when Redis returns an unexpected script result. */
  private async increment(
    key: string,
    limit: number,
  ): Promise<MembershipOwnershipTransferRateLimitDecision> {
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
