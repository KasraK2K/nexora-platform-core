import { AppConfig } from './app-config';

const MANAGED_KEYS = [
  'NODE_ENV',
  'DATABASE_URL',
  'REDIS_URL',
  'APP_ORIGINS',
  'TRUST_PROXY',
  'RATE_LIMIT_KEY_SECRET',
  'COOKIE_SECURE',
  'COOKIE_SAME_SITE',
  'API_DOCS_ENABLED',
  'EMAIL_VERIFICATION_URL',
  'PASSWORD_RESET_URL',
  'MEMBERSHIP_INVITATION_URL',
  'SMTP_REQUIRE_TLS',
  'MAIL_WORKER_ENABLED',
  'MAIL_OUTBOX_ENCRYPTION_KEY',
  'EMAIL_MESSAGE_ID_DOMAIN',
  'EMAIL_FROM',
  'SMTP_HOST',
  'SMTP_PORT',
] as const;

describe('AppConfig production boundary', () => {
  const original = new Map<string, string | undefined>();

  beforeAll(() => {
    for (const key of MANAGED_KEYS) original.set(key, process.env[key]);
  });

  beforeEach(() => Object.assign(process.env, validProductionEnvironment()));

  afterAll(() => {
    for (const [key, value] of original) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('accepts an explicit secure production configuration', () => {
    expect(() => new AppConfig()).not.toThrow();
  });

  it('requires an explicit environment mode', () => {
    delete process.env.NODE_ENV;
    expect(() => new AppConfig()).toThrow();
  });

  it.each([
    ['COOKIE_SECURE', 'false'],
    ['APP_ORIGINS', 'http://app.example.com'],
    ['TRUST_PROXY', '0.0.0.0/0'],
    ['TRUST_PROXY', '10.0.0.0/1'],
    ['API_DOCS_ENABLED', 'true'],
    ['REDIS_URL', 'redis://redis.example.com:6379'],
    [
      'DATABASE_URL',
      'postgresql://user:pass@db.example.com/core?sslmode=require',
    ],
    ['SMTP_REQUIRE_TLS', 'false'],
    ['MAIL_WORKER_ENABLED', 'false'],
    [
      'MAIL_OUTBOX_ENCRYPTION_KEY',
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    ],
    ['EMAIL_MESSAGE_ID_DOMAIN', 'nexora.local'],
  ])('rejects unsafe production %s', (key, value) => {
    process.env[key] = value;
    expect(() => new AppConfig()).toThrow();
  });
});

function validProductionEnvironment(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    DATABASE_URL:
      'postgresql://user:pass@db.example.com/core?sslmode=verify-full',
    REDIS_URL: 'rediss://redis.example.com:6379',
    APP_ORIGINS: 'https://app.example.com',
    TRUST_PROXY: '10.10.0.8/32',
    RATE_LIMIT_KEY_SECRET: 'production-test-rate-limit-secret-value',
    COOKIE_SECURE: 'true',
    COOKIE_SAME_SITE: 'lax',
    API_DOCS_ENABLED: 'false',
    EMAIL_VERIFICATION_URL: 'https://app.example.com/verify-email',
    PASSWORD_RESET_URL: 'https://app.example.com/reset-password',
    MEMBERSHIP_INVITATION_URL: 'https://app.example.com/accept-invitation',
    SMTP_REQUIRE_TLS: 'true',
    MAIL_WORKER_ENABLED: 'true',
    MAIL_OUTBOX_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    EMAIL_MESSAGE_ID_DOMAIN: 'mail.example.com',
    EMAIL_FROM: 'Nexora Platform <no-reply@example.com>',
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '587',
  };
}
