import { isIP } from 'node:net';
import 'dotenv/config';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

const LOCAL_MAIL_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const TRUST_PROXY_NAMES = new Set(['loopback', 'linklocal', 'uniquelocal']);

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3_000),
    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),
    APP_ORIGINS: z.string().min(1),
    TRUST_PROXY: z.string(),
    RATE_LIMIT_KEY_SECRET: z.string().min(32),
    COOKIE_SECURE: z.enum(['true', 'false']),
    COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),
    API_DOCS_ENABLED: z.enum(['true', 'false']).default('true'),
    METRICS_ENABLED: z.enum(['true', 'false']).default('false'),
    METRICS_BEARER_TOKEN: z.string().default(''),
    PWNED_PASSWORDS_ENABLED: z.enum(['true', 'false']).default('true'),
    PWNED_PASSWORDS_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(100)
      .max(5_000)
      .default(1_500),
    SESSION_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(300)
      .max(2_592_000)
      .default(604_800),
    EMAIL_VERIFICATION_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(300)
      .max(604_800)
      .default(86_400),
    EMAIL_VERIFICATION_URL: z
      .url()
      .default('http://localhost:3000/verify-email'),
    PASSWORD_RESET_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(300)
      .max(86_400)
      .default(3_600),
    PASSWORD_RESET_URL: z.url().default('http://localhost:3000/reset-password'),
    MEMBERSHIP_INVITATION_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(300)
      .max(604_800)
      .default(86_400),
    MEMBERSHIP_INVITATION_URL: z
      .url()
      .default('http://localhost:3000/accept-invitation'),
    EMAIL_FROM: z
      .string()
      .min(3)
      .default('Nexora Platform <no-reply@nexora.local>'),
    EMAIL_MESSAGE_ID_DOMAIN: z.string().min(1).default('nexora.local'),
    SMTP_HOST: z.string().min(1).default('localhost'),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(1025),
    SMTP_SECURE: z.enum(['true', 'false']).default('false'),
    SMTP_REQUIRE_TLS: z.enum(['true', 'false']).default('false'),
    SMTP_USER: z.string().default(''),
    SMTP_PASSWORD: z.string().default(''),
    SMTP_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(100)
      .max(30_000)
      .default(5_000),
    MAIL_OUTBOX_ENCRYPTION_KEY: z.string().default(LOCAL_MAIL_KEY),
    MAIL_WORKER_ENABLED: z.enum(['true', 'false']).default('true'),
    MAIL_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
    MAIL_RETRY_BASE_MS: z.coerce
      .number()
      .int()
      .min(100)
      .max(60_000)
      .default(1_000),
    MAIL_RETRY_MAX_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(3_600_000)
      .default(300_000),
    MAIL_POLL_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(250)
      .max(60_000)
      .default(1_000),
    MAIL_CLAIM_TTL_MS: z.coerce
      .number()
      .int()
      .min(5_000)
      .max(300_000)
      .default(30_000),
    DEPENDENCY_HEALTH_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(100)
      .max(10_000)
      .default(2_000),
    SHUTDOWN_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(60_000)
      .default(10_000),
  })
  .superRefine((environment, context) => {
    if (
      !['postgres:', 'postgresql:'].includes(
        new URL(environment.DATABASE_URL).protocol,
      )
    ) {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL must use PostgreSQL.',
      });
    }

    if (
      !['redis:', 'rediss:'].includes(new URL(environment.REDIS_URL).protocol)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['REDIS_URL'],
        message: 'REDIS_URL must use Redis.',
      });
    }

    if (
      environment.COOKIE_SAME_SITE === 'none' &&
      environment.COOKIE_SECURE !== 'true'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['COOKIE_SAME_SITE'],
        message: 'COOKIE_SAME_SITE=none requires COOKIE_SECURE=true.',
      });
    }

    if (
      environment.NODE_ENV === 'production' &&
      environment.COOKIE_SECURE !== 'true'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['COOKIE_SECURE'],
        message: 'COOKIE_SECURE must be true in production.',
      });
    }

    if (
      environment.NODE_ENV === 'production' &&
      new URL(environment.EMAIL_VERIFICATION_URL).protocol !== 'https:'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['EMAIL_VERIFICATION_URL'],
        message: 'EMAIL_VERIFICATION_URL must use HTTPS in production.',
      });
    }

    if (
      environment.NODE_ENV === 'production' &&
      new URL(environment.PASSWORD_RESET_URL).protocol !== 'https:'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['PASSWORD_RESET_URL'],
        message: 'PASSWORD_RESET_URL must use HTTPS in production.',
      });
    }

    if (
      environment.NODE_ENV === 'production' &&
      new URL(environment.MEMBERSHIP_INVITATION_URL).protocol !== 'https:'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['MEMBERSHIP_INVITATION_URL'],
        message: 'MEMBERSHIP_INVITATION_URL must use HTTPS in production.',
      });
    }

    if (Boolean(environment.SMTP_USER) !== Boolean(environment.SMTP_PASSWORD)) {
      context.addIssue({
        code: 'custom',
        path: ['SMTP_USER'],
        message: 'SMTP_USER and SMTP_PASSWORD must be configured together.',
      });
    }

    if (environment.NODE_ENV === 'production') {
      const databaseUrl = new URL(environment.DATABASE_URL);
      const productionRequirements: Array<{
        condition: boolean;
        path: keyof typeof environment;
        message: string;
      }> = [
        {
          condition: environment.TRUST_PROXY.length > 0,
          path: 'TRUST_PROXY',
          message:
            'TRUST_PROXY must explicitly be none or a trusted proxy list in production.',
        },
        {
          condition: process.env.COOKIE_SAME_SITE !== undefined,
          path: 'COOKIE_SAME_SITE',
          message: 'COOKIE_SAME_SITE must be explicitly set in production.',
        },
        {
          condition: environment.API_DOCS_ENABLED === 'false',
          path: 'API_DOCS_ENABLED',
          message: 'API_DOCS_ENABLED must be false in production.',
        },
        {
          condition: environment.MAIL_WORKER_ENABLED === 'true',
          path: 'MAIL_WORKER_ENABLED',
          message: 'MAIL_WORKER_ENABLED must be true in production.',
        },
        {
          condition: environment.SMTP_REQUIRE_TLS === 'true',
          path: 'SMTP_REQUIRE_TLS',
          message: 'SMTP_REQUIRE_TLS must be true in production.',
        },
        {
          condition:
            process.env.SMTP_HOST !== undefined &&
            !['localhost', '127.0.0.1', '::1'].includes(
              environment.SMTP_HOST.toLowerCase(),
            ),
          path: 'SMTP_HOST',
          message: 'SMTP_HOST must be explicitly set for production.',
        },
        {
          condition: process.env.SMTP_PORT !== undefined,
          path: 'SMTP_PORT',
          message: 'SMTP_PORT must be explicitly set for production.',
        },
        {
          condition:
            process.env.EMAIL_FROM !== undefined &&
            !environment.EMAIL_FROM.toLowerCase().includes('.local'),
          path: 'EMAIL_FROM',
          message: 'EMAIL_FROM must be explicitly set for production.',
        },
        {
          condition: new URL(environment.REDIS_URL).protocol === 'rediss:',
          path: 'REDIS_URL',
          message: 'REDIS_URL must use TLS (rediss) in production.',
        },
        {
          condition: databaseUrl.searchParams.get('sslmode') === 'verify-full',
          path: 'DATABASE_URL',
          message: 'DATABASE_URL must use sslmode=verify-full in production.',
        },
        {
          condition: environment.MAIL_OUTBOX_ENCRYPTION_KEY !== LOCAL_MAIL_KEY,
          path: 'MAIL_OUTBOX_ENCRYPTION_KEY',
          message:
            'MAIL_OUTBOX_ENCRYPTION_KEY must not use the development key in production.',
        },
        {
          condition:
            isHostname(environment.EMAIL_MESSAGE_ID_DOMAIN) &&
            !environment.EMAIL_MESSAGE_ID_DOMAIN.endsWith('.local'),
          path: 'EMAIL_MESSAGE_ID_DOMAIN',
          message: 'EMAIL_MESSAGE_ID_DOMAIN must be a production DNS hostname.',
        },
      ];
      for (const requirement of productionRequirements) {
        if (!requirement.condition) {
          context.addIssue({
            code: 'custom',
            path: [requirement.path],
            message: requirement.message,
          });
        }
      }
    }

    if (
      Buffer.from(environment.MAIL_OUTBOX_ENCRYPTION_KEY, 'base64').length !==
      32
    ) {
      context.addIssue({
        code: 'custom',
        path: ['MAIL_OUTBOX_ENCRYPTION_KEY'],
        message:
          'MAIL_OUTBOX_ENCRYPTION_KEY must be a base64-encoded 32-byte key.',
      });
    }

    if (
      environment.METRICS_ENABLED === 'true' &&
      environment.METRICS_BEARER_TOKEN.length < 32
    ) {
      context.addIssue({
        code: 'custom',
        path: ['METRICS_BEARER_TOKEN'],
        message:
          'METRICS_BEARER_TOKEN must contain at least 32 characters when metrics are enabled.',
      });
    }

    if (environment.MAIL_RETRY_MAX_MS < environment.MAIL_RETRY_BASE_MS) {
      context.addIssue({
        code: 'custom',
        path: ['MAIL_RETRY_MAX_MS'],
        message:
          'MAIL_RETRY_MAX_MS must be greater than or equal to MAIL_RETRY_BASE_MS.',
      });
    }

    if (environment.TRUST_PROXY || environment.NODE_ENV === 'production') {
      validateTrustedProxies(environment.TRUST_PROXY, context);
    }

    for (const origin of environment.APP_ORIGINS.split(',').map((value) =>
      value.trim(),
    )) {
      let parsed: URL;
      try {
        parsed = new URL(origin);
      } catch {
        context.addIssue({
          code: 'custom',
          path: ['APP_ORIGINS'],
          message:
            'APP_ORIGINS must contain canonical origins, using HTTPS in production.',
        });
        continue;
      }

      if (
        origin !== parsed.origin ||
        !['http:', 'https:'].includes(parsed.protocol) ||
        (environment.NODE_ENV === 'production' && parsed.protocol !== 'https:')
      ) {
        context.addIssue({
          code: 'custom',
          path: ['APP_ORIGINS'],
          message:
            'APP_ORIGINS must contain canonical origins, using HTTPS in production.',
        });
      }
    }
  });

@Injectable()
export class AppConfig {
  private readonly environment = environmentSchema.parse(process.env);

  readonly nodeEnvironment = this.environment.NODE_ENV;
  readonly port = this.environment.PORT;
  readonly databaseUrl = this.environment.DATABASE_URL;
  readonly redisUrl = this.environment.REDIS_URL;
  readonly cookieSecure = this.environment.COOKIE_SECURE === 'true';
  readonly cookieSameSite = this.environment.COOKIE_SAME_SITE;
  readonly apiDocsEnabled = this.environment.API_DOCS_ENABLED === 'true';
  readonly metricsEnabled = this.environment.METRICS_ENABLED === 'true';
  readonly metricsBearerToken = this.environment.METRICS_BEARER_TOKEN;
  readonly pwnedPasswordsEnabled =
    this.environment.PWNED_PASSWORDS_ENABLED === 'true';
  readonly pwnedPasswordsTimeoutMs =
    this.environment.PWNED_PASSWORDS_TIMEOUT_MS;
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
  readonly smtpHost = this.environment.SMTP_HOST;
  readonly smtpPort = this.environment.SMTP_PORT;
  readonly smtpSecure = this.environment.SMTP_SECURE === 'true';
  readonly smtpRequireTls = this.environment.SMTP_REQUIRE_TLS === 'true';
  readonly smtpUser = this.environment.SMTP_USER;
  readonly smtpPassword = this.environment.SMTP_PASSWORD;
  readonly smtpTimeoutMs = this.environment.SMTP_TIMEOUT_MS;
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

  get isProduction(): boolean {
    return this.nodeEnvironment === 'production';
  }

  get sessionCookieName(): string {
    return this.cookieSecure ? '__Host-nexora_session' : 'nexora_session';
  }
}

function validateTrustedProxies(value: string, context: z.RefinementCtx): void {
  if (value === 'none') return;
  const entries = value.split(',').map((entry) => entry.trim());
  if (
    entries.some(
      (entry) =>
        !entry || (!TRUST_PROXY_NAMES.has(entry) && !isIpOrCidr(entry)),
    )
  ) {
    context.addIssue({
      code: 'custom',
      path: ['TRUST_PROXY'],
      message:
        'TRUST_PROXY must be none, a named private range, or an IP/CIDR list.',
    });
  }
}

function isIpOrCidr(value: string): boolean {
  const [address, prefix, extra] = value.split('/');
  if (extra !== undefined) return false;
  const version = isIP(address);
  if (version === 0) return false;
  if (prefix === undefined) return true;
  if (!/^\d{1,3}$/.test(prefix)) return false;
  const bits = Number(prefix);
  return version === 4 ? bits >= 8 && bits <= 32 : bits >= 32 && bits <= 128;
}

function isHostname(value: string): boolean {
  return (
    value.length <= 253 &&
    value
      .split('.')
      .every((label) => /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)$/.test(label))
  );
}
