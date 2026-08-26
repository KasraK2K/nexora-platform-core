import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import type { RateLimitDecision } from './authentication-rate-limiter';

const WINDOW_SECONDS = 15 * 60;
const SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}
`; // Atomic fixed-window counter rate-limiter

/** Redis fixed-window limiter with HMAC-pseudonymous IP, email, and session keys. */
@Injectable()
export class AuthenticationRateLimiter {
  constructor(
    private readonly redis: RedisService,
    private readonly config: AppConfig,
  ) {}

  /** Applies registration limits by IP and, when available, normalized email. */
  async checkRegistration(
    clientIp: string,
    normalizedEmail?: string,
  ): Promise<RateLimitDecision> {
    return this.check('registration', clientIp, normalizedEmail, 10, 5);
  }

  /** Applies login limits by IP and, when available, normalized email. */
  async checkLogin(
    clientIp: string,
    normalizedEmail?: string,
  ): Promise<RateLimitDecision> {
    return this.check('login', clientIp, normalizedEmail, 20, 10);
  }

  /** Applies verification-request limits without storing the email in Redis keys. */
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

  /** Applies an IP-only limit before verification-token processing. */
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

  /** Applies reset-request limits by IP and, when available, normalized email. */
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

  /** Applies an IP-only limit before reset-token and password processing. */
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

  /** Applies IP and hashed-session limits before current-password verification. */
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

  /** Applies IP and hashed-session limits before tenant switching. */
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

  /** Checks the IP bucket first so a blocked source cannot consume identifier work. */
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

  /** Executes the increment-and-expiry Lua script atomically and fails closed on bad output. */
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

  /** Pseudonymizes sensitive limiter dimensions with a deployment secret. */
  private digest(value: string): string {
    return createHmac('sha256', this.config.rateLimitKeySecret)
      .update(value, 'utf8')
      .digest('hex');
  }
}
