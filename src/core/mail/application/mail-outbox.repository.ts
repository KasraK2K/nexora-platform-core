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
  lockedUntil: Date;
  expiresAt: Date;
}>;

/**
 * Persists the durable mail state machine. Claiming and completion are
 * compare-and-set operations; the incremented attempt count fences a stale
 * worker after another worker reclaims an expired lease. SMTP delivery remains
 * at-least-once because a process can still fail after the provider accepts a
 * message but before the sent transition commits.
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
  findDueIds(now: Date, limit: number, maxAttempts: number): Promise<string[]>;
  /** Leases one due message, returning `null` when another worker won the claim. */
  claim(
    id: string,
    now: Date,
    lockedUntil: Date,
    maxAttempts: number,
  ): Promise<ClaimedMail | null>;
  /** Extends only the current, unexpired processing generation's lease. */
  renewLease(input: {
    id: string;
    attemptCount: number;
    now: Date;
    lockedUntil: Date;
  }): Promise<boolean>;
  /** Marks the current processing attempt sent and erases its encrypted payload. */
  markSent(input: {
    id: string;
    attemptCount: number;
    sentAt: Date;
  }): Promise<void>;
  /** Moves the current processing attempt to its next bounded retry time. */
  markRetry(input: {
    id: string;
    attemptCount: number;
    attemptedAt: Date;
    nextAttemptAt: Date;
  }): Promise<void>;
  /** Marks the current processing attempt failed and erases its payload. */
  markFailed(input: {
    id: string;
    attemptCount: number;
    failedAt: Date;
  }): Promise<void>;
  /** Fails expired or attempt-exhausted abandoned rows and returns the count. */
  expireDue(now: Date, maxAttempts: number): Promise<number>;
}
