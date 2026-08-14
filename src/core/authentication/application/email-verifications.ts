import { Inject, Injectable } from '@nestjs/common';

/** Injection token for email-verification persistence. */
export const EMAIL_VERIFICATIONS_REPOSITORY = Symbol(
  'EMAIL_VERIFICATIONS_REPOSITORY',
);

/** Safe fields returned after a verification token has been matched. */
export type EmailVerificationRecord = {
  id: string;
  userId: string;
  workspaceId: string;
};

/** Persistence contract for expiring, replaceable, single-use verifications. */
export interface EmailVerificationsRepository {
  /** Inserts an expiring verification record containing only the token hash. */
  create(input: {
    id: string;
    userId: string;
    workspaceId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  /** Invalidates every still-open verification for a user. */
  invalidateOpenForUser(userId: string, invalidatedAt: Date): Promise<void>;
  /** Finds a matching token only while it is open and unexpired. */
  findUsableByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<EmailVerificationRecord | null>;
  /** Finds the user's latest verification for replacement delivery context. */
  findLatestForUser(userId: string): Promise<EmailVerificationRecord | null>;
  /** Conditionally consumes one usable record, returning whether this call won. */
  consume(id: string, consumedAt: Date): Promise<boolean>;
  /** Records the latest immediate mail-delivery outcome. */
  markDelivery(
    id: string,
    status: 'SENT' | 'FAILED',
    attemptedAt: Date,
  ): Promise<void>;
}

/** Application-facing gateway to email-verification state. */
@Injectable()
export class EmailVerifications {
  constructor(
    @Inject(EMAIL_VERIFICATIONS_REPOSITORY)
    private readonly repository: EmailVerificationsRepository,
  ) {}

  /** Persists a hashed token; the surrounding use case owns the transaction. */
  create(input: {
    id: string;
    userId: string;
    workspaceId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    return this.repository.create(input);
  }

  /** Invalidates all unconsumed verification links for a user. */
  invalidateOpenForUser(userId: string, invalidatedAt: Date): Promise<void> {
    return this.repository.invalidateOpenForUser(userId, invalidatedAt);
  }

  /** Finds a matching token only while it remains open and unexpired. */
  findUsableByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<EmailVerificationRecord | null> {
    return this.repository.findUsableByTokenHash(tokenHash, now);
  }

  /** Retrieves the latest record used to retain workspace delivery context. */
  findLatestForUser(userId: string): Promise<EmailVerificationRecord | null> {
    return this.repository.findLatestForUser(userId);
  }

  /** Atomically consumes an open, unexpired verification exactly once. */
  consume(id: string, consumedAt: Date): Promise<boolean> {
    return this.repository.consume(id, consumedAt);
  }

  /** Records a best-effort immediate delivery outcome. */
  markDelivery(
    id: string,
    status: 'SENT' | 'FAILED',
    attemptedAt: Date,
  ): Promise<void> {
    return this.repository.markDelivery(id, status, attemptedAt);
  }
}
