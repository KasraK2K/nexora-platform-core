import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../configuration/app-config';
import { RedisService } from '../../redis/redis.service';

export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
};

const WINDOW_SECONDS = 15 * 60;
const SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}
`;

@Injectable()
export class RegistrationRateLimiter {
  constructor(
    private readonly redis: RedisService,
    private readonly config: AppConfig,
  ) {}

  async check(
    clientIp: string,
    normalizedEmail?: string,
  ): Promise<RateLimitDecision> {
    const ipDecision = await this.increment(
      `auth:registration:ip:${this.digest(clientIp)}`,
      10,
    );
    if (!ipDecision.allowed || !normalizedEmail) {
      return ipDecision;
    }

    return this.increment(
      `auth:registration:email:${this.digest(normalizedEmail)}`,
      5,
    );
  }

  private async increment(
    key: string,
    limit: number,
  ): Promise<RateLimitDecision> {
    const result = await this.redis.client.eval(SCRIPT, {
      keys: [key],
      arguments: [WINDOW_SECONDS.toString()],
    });

    if (!Array.isArray(result) || result.length !== 2) {
      return { allowed: false, retryAfterSeconds: WINDOW_SECONDS };
    }

    const count = Number(result[0]);
    const ttl = Math.max(1, Number(result[1]));
    return { allowed: count <= limit, retryAfterSeconds: ttl };
  }

  private digest(value: string): string {
    return createHmac('sha256', this.config.rateLimitKeySecret)
      .update(value, 'utf8')
      .digest('hex');
  }
}
