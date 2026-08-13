import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { AppConfig } from '../src/core/configuration/app-config';

const approvalSchema = z.strictObject({
  approvalId: z.string().min(1),
  approvedAt: z.iso.datetime(),
  approvedBy: z.string().min(1),
  environment: z.string().min(1),
  region: z.string().min(1),
  infrastructure: z.strictObject({
    postgresql: z.string().min(1),
    redis: z.string().min(1),
    smtp: z.string().min(1),
    secretManager: z.string().min(1),
    observability: z.string().min(1),
  }),
  objectives: z.strictObject({
    rpoMinutes: z.number().positive(),
    rtoMinutes: z.number().positive(),
    availabilitySloPercent: z.number().positive().max(100),
    latencyP95Milliseconds: z.number().positive(),
  }),
  capacity: z.strictObject({
    requestsPerSecond: z.number().int().positive(),
    concurrentRequests: z.number().int().positive(),
    maximumMailQueueDepth: z.number().int().positive(),
    smtpMessagesPerHour: z.number().int().positive(),
  }),
  alerts: z.strictObject({
    readinessFailures: z.number().int().positive(),
    mailQueueAgeSeconds: z.number().int().positive(),
    terminalMailFailures: z.number().int().positive(),
    errorRatePercent: z.number().positive().max(100),
  }),
  retentionDays: z.strictObject({
    sessions: z.number().int().nonnegative(),
    verificationAndReset: z.number().int().nonnegative(),
    invitations: z.number().int().nonnegative(),
    mailOutbox: z.number().int().nonnegative(),
    audit: z.number().int().nonnegative(),
    logs: z.number().int().nonnegative(),
    traces: z.number().int().nonnegative(),
  }),
  incidentContact: z.string().min(1),
  restoreDrillEvidence: z.string().min(1),
  rollbackOwner: z.string().min(1),
  privacyOwner: z.string().min(1),
});

try {
  if (process.env.NODE_ENV !== 'production') {
    throw new Error('NODE_ENV must be production.');
  }
  new AppConfig();
  const approvalFile = process.env.PRODUCTION_APPROVAL_FILE;
  if (!approvalFile) {
    throw new Error('PRODUCTION_APPROVAL_FILE is required.');
  }
  const approval: unknown = JSON.parse(readFileSync(approvalFile, 'utf8'));
  approvalSchema.parse(approval);
  process.stdout.write(
    'Production runtime configuration and operator approval are valid.\n',
  );
} catch (error) {
  const issues =
    error instanceof z.ZodError
      ? error.issues.map((issue) => issue.path.join('.')).filter(Boolean)
      : [];
  process.stderr.write(
    `Production readiness gate failed${issues.length ? ` at: ${issues.join(', ')}` : ''}.\n`,
  );
  process.exitCode = 1;
}
