export const MAIL_OUTBOX_REPOSITORY = Symbol('MAIL_OUTBOX_REPOSITORY');

export type MailPurpose =
  'EMAIL_VERIFICATION' | 'PASSWORD_RESET' | 'MEMBERSHIP_INVITATION';

export type ClaimedMail = Readonly<{
  id: string;
  encryptedPayload: string;
  messageId: string;
  correlationId: string;
  attemptCount: number;
  expiresAt: Date;
}>;

export interface MailOutboxRepository {
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
  findDueIds(now: Date, limit: number): Promise<string[]>;
  claim(id: string, now: Date, lockedUntil: Date): Promise<ClaimedMail | null>;
  markSent(id: string, sentAt: Date): Promise<void>;
  markRetry(id: string, attemptedAt: Date, nextAttemptAt: Date): Promise<void>;
  markFailed(id: string, failedAt: Date): Promise<void>;
  expireDue(now: Date): Promise<number>;
}
