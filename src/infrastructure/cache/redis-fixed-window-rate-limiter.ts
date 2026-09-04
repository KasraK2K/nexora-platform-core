import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { RateLimitDecision } from '../../common/http/request-rate-limit';
import { AppConfig } from '../../config/app-config';
import { RedisService } from './redis.service';

const WINDOW_SECONDS = 15 * 60;
const SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}
`;

/** One shared Redis fixed-window and privacy-key implementation. */
@Injectable()
export class RedisFixedWindowRateLimiter {
  constructor(
    private readonly redis: RedisService,
    private readonly config: AppConfig,
  ) {}

  async increment(key: string, limit: number): Promise<RateLimitDecision> {
    const result = await this.redis.client.eval(SCRIPT, {
      keys: [key],
      arguments: [WINDOW_SECONDS.toString()],
    });
    if (!Array.isArray(result) || result.length !== 2) {
      return { allowed: false, retryAfterSeconds: WINDOW_SECONDS };
    }
    const current = Number(result[0]);
    const ttl = Number(result[1]);
    if (
      !Number.isSafeInteger(current) ||
      current < 1 ||
      !Number.isSafeInteger(ttl) ||
      ttl < 0 ||
      ttl > WINDOW_SECONDS
    ) {
      return { allowed: false, retryAfterSeconds: WINDOW_SECONDS };
    }
    return {
      allowed: current <= limit,
      retryAfterSeconds: Math.max(1, ttl),
    };
  }

  digest(value: string): string {
    return createHmac('sha256', this.config.rateLimitKeySecret)
      .update(value, 'utf8')
      .digest('hex');
  }
}
