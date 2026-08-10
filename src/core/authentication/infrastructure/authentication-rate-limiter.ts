import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../configuration/app-config';
import { RedisService } from '../../redis/redis.service';
import type {
  AuthenticationRateLimitPort,
  RateLimitDecision,
} from '../application/authentication-rate-limiter.port';

const WINDOW_SECONDS = 15 * 60;
const SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}
`; // Atomic fixed-window counter rate-limiter

@Injectable()
export class AuthenticationRateLimiter implements AuthenticationRateLimitPort {
  constructor(
    private readonly redis: RedisService,
    private readonly config: AppConfig,
  ) {}

  async checkRegistration(
    clientIp: string,
    normalizedEmail?: string,
  ): Promise<RateLimitDecision> {
    return this.check('registration', clientIp, normalizedEmail, 10, 5);
  }

  async checkLogin(
    clientIp: string,
    normalizedEmail?: string,
  ): Promise<RateLimitDecision> {
    return this.check('login', clientIp, normalizedEmail, 20, 10);
  }

  async checkEmailVerificationRequest(
    clientIp: string,
    normalizedEmail?: string,
  ): Promise<RateLimitDecision> {
    return this.check(
      'email-verification-request',
      clientIp,
      normalizedEmail,
      20,
      5,
    );
  }

  async checkEmailVerificationConfirmation(
    clientIp: string,
  ): Promise<RateLimitDecision> {
    return this.check(
      'email-verification-confirmation',
      clientIp,
      undefined,
      30,
      30,
    );
  }

  async checkPasswordResetRequest(
    clientIp: string,
    normalizedEmail?: string,
  ): Promise<RateLimitDecision> {
    return this.check(
      'password-reset-request',
      clientIp,
      normalizedEmail,
      20,
      5,
    );
  }

  async checkPasswordResetConfirmation(
    clientIp: string,
  ): Promise<RateLimitDecision> {
    return this.check(
      'password-reset-confirmation',
      clientIp,
      undefined,
      30,
      30,
    );
  }

  async checkPasswordChange(
    clientIp: string,
    sessionToken?: string,
  ): Promise<RateLimitDecision> {
    const ipDecision = await this.increment(
      `auth:password-change:ip:${this.digest(clientIp)}`,
      10,
    );
    if (!ipDecision.allowed || !sessionToken) {
      return ipDecision;
    }

    return this.increment(
      `auth:password-change:session:${this.digest(sessionToken)}`,
      5,
    );
  }

  async checkWorkspaceSwitch(
    clientIp: string,
    sessionToken?: string,
  ): Promise<RateLimitDecision> {
    const ipDecision = await this.increment(
      `auth:workspace-switch:ip:${this.digest(clientIp)}`,
      30,
    );
    if (!ipDecision.allowed || !sessionToken) {
      return ipDecision;
    }

    return this.increment(
      `auth:workspace-switch:session:${this.digest(sessionToken)}`,
      10,
    );
  }

  private async check(
    scope: string,
    clientIp: string,
    normalizedEmail: string | undefined,
    ipLimit: number,
    emailLimit: number,
  ): Promise<RateLimitDecision> {
    const ipDecision = await this.increment(
      `auth:${scope}:ip:${this.digest(clientIp)}`,
      ipLimit,
    );
    if (!ipDecision.allowed || !normalizedEmail) {
      return ipDecision;
    }

    return this.increment(
      `auth:${scope}:email:${this.digest(normalizedEmail)}`,
      emailLimit,
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
