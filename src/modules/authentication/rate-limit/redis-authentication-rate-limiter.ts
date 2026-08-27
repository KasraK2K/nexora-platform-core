import { Injectable } from '@nestjs/common';
import { RedisFixedWindowRateLimiter } from '../../../infrastructure/cache/redis-fixed-window-rate-limiter';
import type { RateLimitDecision } from './authentication-rate-limiter';

/** Redis fixed-window limiter with HMAC-pseudonymous IP, email, and session keys. */
@Injectable()
export class AuthenticationRateLimiter {
  constructor(private readonly windows: RedisFixedWindowRateLimiter) {}

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
    return this.windows.increment(key, limit);
  }

  /** Pseudonymizes sensitive limiter dimensions with a deployment secret. */
  private digest(value: string): string {
    return this.windows.digest(value);
  }
}
