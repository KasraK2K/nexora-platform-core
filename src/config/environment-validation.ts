import { isIP } from 'node:net';
import type { z } from 'zod';
import { LOCAL_MAIL_KEY, type Environment } from './environment.schema';

const TRUST_PROXY_NAMES = new Set(['loopback', 'linklocal', 'uniquelocal']);

/** Applies protocol, cross-field, and production-only environment safeguards. */
export function validateEnvironment(
  environment: Environment,
  context: z.RefinementCtx,
): void {
  if (
    !['postgres:', 'postgresql:'].includes(
      new URL(environment.DATABASE_URL).protocol,
    )
  ) {
    addIssue(context, 'DATABASE_URL', 'DATABASE_URL must use PostgreSQL.');
  }
  if (
    !['redis:', 'rediss:'].includes(new URL(environment.REDIS_URL).protocol)
  ) {
    addIssue(context, 'REDIS_URL', 'REDIS_URL must use Redis.');
  }
  if (
    environment.COOKIE_SAME_SITE === 'none' &&
    environment.COOKIE_SECURE !== 'true'
  ) {
    addIssue(
      context,
      'COOKIE_SAME_SITE',
      'COOKIE_SAME_SITE=none requires COOKIE_SECURE=true.',
    );
  }
  if (
    environment.NODE_ENV === 'production' &&
    environment.COOKIE_SECURE !== 'true'
  ) {
    addIssue(
      context,
      'COOKIE_SECURE',
      'COOKIE_SECURE must be true in production.',
    );
  }

  validateProductionUrls(environment, context);
  if (environment.NODE_ENV === 'production') {
    validateProductionEnvironment(environment, context);
  }

  if (
    Buffer.from(environment.MAIL_OUTBOX_ENCRYPTION_KEY, 'base64').length !== 32
  ) {
    addIssue(
      context,
      'MAIL_OUTBOX_ENCRYPTION_KEY',
      'MAIL_OUTBOX_ENCRYPTION_KEY must be a base64-encoded 32-byte key.',
    );
  }
  if (
    environment.METRICS_ENABLED === 'true' &&
    environment.METRICS_BEARER_TOKEN.length < 32
  ) {
    addIssue(
      context,
      'METRICS_BEARER_TOKEN',
      'METRICS_BEARER_TOKEN must contain at least 32 characters when metrics are enabled.',
    );
  }
  if (environment.MAIL_RETRY_MAX_MS < environment.MAIL_RETRY_BASE_MS) {
    addIssue(
      context,
      'MAIL_RETRY_MAX_MS',
      'MAIL_RETRY_MAX_MS must be greater than or equal to MAIL_RETRY_BASE_MS.',
    );
  }
  if (environment.TRUST_PROXY || environment.NODE_ENV === 'production') {
    validateTrustedProxies(environment.TRUST_PROXY, context);
  }
  validateOrigins(environment, context);
}

function validateProductionUrls(
  environment: Environment,
  context: z.RefinementCtx,
): void {
  if (environment.NODE_ENV !== 'production') return;
  const urls: Array<{
    key:
      | 'EMAIL_VERIFICATION_URL'
      | 'PASSWORD_RESET_URL'
      | 'MEMBERSHIP_INVITATION_URL';
    message: string;
  }> = [
    {
      key: 'EMAIL_VERIFICATION_URL',
      message: 'EMAIL_VERIFICATION_URL must use HTTPS in production.',
    },
    {
      key: 'PASSWORD_RESET_URL',
      message: 'PASSWORD_RESET_URL must use HTTPS in production.',
    },
    {
      key: 'MEMBERSHIP_INVITATION_URL',
      message: 'MEMBERSHIP_INVITATION_URL must use HTTPS in production.',
    },
  ];
  for (const { key, message } of urls) {
    if (new URL(environment[key]).protocol !== 'https:')
      addIssue(context, key, message);
  }
}

function validateProductionEnvironment(
  environment: Environment,
  context: z.RefinementCtx,
): void {
  const databaseUrl = new URL(environment.DATABASE_URL);
  const requirements: Array<{
    condition: boolean;
    path: keyof Environment;
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
      condition:
        process.env.RESEND_API_KEY !== undefined &&
        environment.RESEND_API_KEY !== 're_local_development_placeholder',
      path: 'RESEND_API_KEY',
      message: 'RESEND_API_KEY must be explicitly set for production.',
    },
    {
      condition:
        process.env.EMAIL_FROM !== undefined &&
        !environment.EMAIL_FROM.toLowerCase().includes('.local') &&
        !environment.EMAIL_FROM.toLowerCase().includes('@resend.dev'),
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
  for (const requirement of requirements) {
    if (!requirement.condition)
      addIssue(context, requirement.path, requirement.message);
  }
}

function validateOrigins(
  environment: Environment,
  context: z.RefinementCtx,
): void {
  for (const origin of environment.APP_ORIGINS.split(',').map((value) =>
    value.trim(),
  )) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      addIssue(
        context,
        'APP_ORIGINS',
        'APP_ORIGINS must contain canonical origins, using HTTPS in production.',
      );
      continue;
    }
    if (
      origin !== parsed.origin ||
      !['http:', 'https:'].includes(parsed.protocol) ||
      (environment.NODE_ENV === 'production' && parsed.protocol !== 'https:')
    ) {
      addIssue(
        context,
        'APP_ORIGINS',
        'APP_ORIGINS must contain canonical origins, using HTTPS in production.',
      );
    }
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
    addIssue(
      context,
      'TRUST_PROXY',
      'TRUST_PROXY must be none, a named private range, or an IP/CIDR list.',
    );
  }
}

function addIssue(
  context: z.RefinementCtx,
  path: keyof Environment,
  message: string,
): void {
  context.addIssue({ code: 'custom', path: [path], message });
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
