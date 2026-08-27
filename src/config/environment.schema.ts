import { z } from 'zod';

/** Deliberately insecure development key rejected by production validation. */
export const LOCAL_MAIL_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

/** Defines individual environment values, coercion, defaults, and size limits. */
export const environmentSchema = z.object({
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
  EMAIL_VERIFICATION_URL: z.url().default('http://localhost:3000/verify-email'),
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
  RESEND_API_KEY: z
    .string()
    .startsWith('re_')
    .default('re_local_development_placeholder'),
  RESEND_TIMEOUT_MS: z.coerce
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
});

/** Environment values after field-level parsing and defaulting. */
export type Environment = z.infer<typeof environmentSchema>;
