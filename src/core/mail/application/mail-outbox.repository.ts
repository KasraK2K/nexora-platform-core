/** Injection token for durable mail state owned by the Mail module. */
export const MAIL_OUTBOX_REPOSITORY = Symbol('MAIL_OUTBOX_REPOSITORY');

/** Core workflow that created a durable email. */
export type MailPurpose =
  'EMAIL_VERIFICATION' | 'PASSWORD_RESET' | 'MEMBERSHIP_INVITATION';

/** Encrypted message and retry state leased to one delivery attempt. */
export type ClaimedMail = Readonly<{
  id: string;
  encryptedPayload: string;
  messageId: string;
  correlationId: string;
  attemptCount: number;
  expiresAt: Date;
}>;

/**
 * Persists the durable mail state machine. Claiming is conditional to reduce
 * concurrent pickup, but completion updates are not protected by a lease token;
 * delivery therefore remains at-least-once rather than exactly-once.
 */
export interface MailOutboxRepository {
  /** Idempotently stores encrypted mail, normally inside a business transaction. */
  create(input: {
    id: string;
    workspaceId: string;
    purpose: MailPurpose;
    idempotencyKey: string;
    messageId: string;
    encryptedPayload: string;
    correlationId: string;
    expiresAt: Date;
  }): Promise<void>;
  /** Lists a bounded batch of due or abandoned-claim message IDs. */
  findDueIds(now: Date, limit: number): Promise<string[]>;
  /** Leases one due message, returning `null` when another worker won the claim. */
  claim(id: string, now: Date, lockedUntil: Date): Promise<ClaimedMail | null>;
  /** Marks a processing row sent and erases its encrypted payload. */
  markSent(id: string, sentAt: Date): Promise<void>;
  /** Moves a processing row to its next bounded retry time. */
  markRetry(id: string, attemptedAt: Date, nextAttemptAt: Date): Promise<void>;
  /** Marks a processing row permanently failed and erases its payload. */
  markFailed(id: string, failedAt: Date): Promise<void>;
  /** Fails expired pending messages and returns how many were changed. */
  expireDue(now: Date): Promise<number>;
}
