import { Injectable } from '@nestjs/common';
import { loadEnvironment } from './environment';

/** Exposes validated, normalized runtime settings through one Nest provider. */
@Injectable()
export class AppConfig {
  private readonly environment = loadEnvironment();

  readonly nodeEnvironment = this.environment.NODE_ENV;
  readonly port = this.environment.PORT;
  readonly databaseUrl = this.environment.DATABASE_URL;
  readonly redisUrl = this.environment.REDIS_URL;
  readonly cookieSecure = this.environment.COOKIE_SECURE === 'true';
  readonly cookieSameSite = this.environment.COOKIE_SAME_SITE;
  readonly apiDocsEnabled = this.environment.API_DOCS_ENABLED === 'true';
  readonly metricsEnabled = this.environment.METRICS_ENABLED === 'true';
  readonly metricsBearerToken = this.environment.METRICS_BEARER_TOKEN;
  readonly sessionTtlSeconds = this.environment.SESSION_TTL_SECONDS;
  readonly emailVerificationTtlSeconds =
    this.environment.EMAIL_VERIFICATION_TTL_SECONDS;
  readonly emailVerificationUrl = this.environment.EMAIL_VERIFICATION_URL;
  readonly passwordResetTtlSeconds =
    this.environment.PASSWORD_RESET_TTL_SECONDS;
  readonly passwordResetUrl = this.environment.PASSWORD_RESET_URL;
  readonly membershipInvitationTtlSeconds =
    this.environment.MEMBERSHIP_INVITATION_TTL_SECONDS;
  readonly membershipInvitationUrl = this.environment.MEMBERSHIP_INVITATION_URL;
  readonly emailFrom = this.environment.EMAIL_FROM;
  readonly emailMessageIdDomain = this.environment.EMAIL_MESSAGE_ID_DOMAIN;
  readonly resendApiKey = this.environment.RESEND_API_KEY;
  readonly resendTimeoutMs = this.environment.RESEND_TIMEOUT_MS;
  readonly mailOutboxEncryptionKey = Buffer.from(
    this.environment.MAIL_OUTBOX_ENCRYPTION_KEY,
    'base64',
  );
  readonly mailWorkerEnabled = this.environment.MAIL_WORKER_ENABLED === 'true';
  readonly mailMaxAttempts = this.environment.MAIL_MAX_ATTEMPTS;
  readonly mailRetryBaseMs = this.environment.MAIL_RETRY_BASE_MS;
  readonly mailRetryMaxMs = this.environment.MAIL_RETRY_MAX_MS;
  readonly mailPollIntervalMs = this.environment.MAIL_POLL_INTERVAL_MS;
  readonly mailClaimTtlMs = this.environment.MAIL_CLAIM_TTL_MS;
  readonly dependencyHealthTimeoutMs =
    this.environment.DEPENDENCY_HEALTH_TIMEOUT_MS;
  readonly shutdownTimeoutMs = this.environment.SHUTDOWN_TIMEOUT_MS;
  readonly trustedProxies =
    this.environment.TRUST_PROXY === 'none'
      ? []
      : this.environment.TRUST_PROXY.split(',').map((proxy) => proxy.trim());
  readonly rateLimitKeySecret = this.environment.RATE_LIMIT_KEY_SECRET;
  readonly allowedOrigins = new Set(
    this.environment.APP_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

  /** Tells security-sensitive callers whether production rules apply. */
  get isProduction(): boolean {
    return this.nodeEnvironment === 'production';
  }

  /** Uses the `__Host-` cookie prefix only for Secure cookies. */
  get sessionCookieName(): string {
    return this.cookieSecure ? '__Host-nexora_session' : 'nexora_session';
  }
}
