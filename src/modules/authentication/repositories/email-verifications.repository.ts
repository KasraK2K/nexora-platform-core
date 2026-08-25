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
  /** Invalidates every still-open verification for one user. */
  invalidateOpenForUser(userId: string, invalidatedAt: Date): Promise<void>;
  /** Finds a matching verification only while it is open and unexpired. */
  findUsableByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<EmailVerificationRecord | null>;
  /** Finds the latest verification for replacement-delivery context. */
  findLatestForUser(userId: string): Promise<EmailVerificationRecord | null>;
  /** Conditionally consumes one usable verification exactly once. */
  consume(id: string, consumedAt: Date): Promise<boolean>;
  /** Records only the coarse immediate mail-delivery outcome. */
  markDelivery(
    id: string,
    status: 'SENT' | 'FAILED',
    attemptedAt: Date,
  ): Promise<void>;
}
