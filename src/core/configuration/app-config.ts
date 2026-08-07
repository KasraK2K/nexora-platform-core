import 'dotenv/config';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),
    APP_ORIGINS: z.string().min(1),
    TRUST_PROXY: z.string().default(''),
    RATE_LIMIT_KEY_SECRET: z.string().min(32),
    COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
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
  })
  .superRefine((environment, context) => {
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
  readonly databaseUrl = this.environment.DATABASE_URL;
  readonly redisUrl = this.environment.REDIS_URL;
  readonly cookieSecure = this.environment.COOKIE_SECURE === 'true';
  readonly pwnedPasswordsEnabled =
    this.environment.PWNED_PASSWORDS_ENABLED === 'true';
  readonly pwnedPasswordsTimeoutMs =
    this.environment.PWNED_PASSWORDS_TIMEOUT_MS;
  readonly sessionTtlSeconds = this.environment.SESSION_TTL_SECONDS;
  readonly trustedProxies = this.environment.TRUST_PROXY.split(',')
    .map((proxy) => proxy.trim())
    .filter(Boolean);
  readonly rateLimitKeySecret = this.environment.RATE_LIMIT_KEY_SECRET;
  readonly allowedOrigins = new Set(
    this.environment.APP_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

  get sessionCookieName(): string {
    return this.cookieSecure ? '__Host-nexora_session' : 'nexora_session';
  }
}
