import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../configuration/app-config';
import { RedisService } from '../../redis/redis.service';
import type {
  MembershipOwnershipTransferRateLimitDecision,
  MembershipOwnershipTransferRateLimiterPort,
} from '../application/membership-ownership-transfer-rate-limiter.port';

const WINDOW_SECONDS = 15 * 60;
const SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}
`;

@Injectable()
export class MembershipOwnershipTransferRateLimiter implements MembershipOwnershipTransferRateLimiterPort {
  constructor(
    private readonly redis: RedisService,
    private readonly config: AppConfig,
  ) {}

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

  private digest(value: string): string {
    return createHmac('sha256', this.config.rateLimitKeySecret)
      .update(value, 'utf8')
      .digest('hex');
  }
}
