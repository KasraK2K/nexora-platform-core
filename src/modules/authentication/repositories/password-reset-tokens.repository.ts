/** Injection token for password-reset token persistence. */
export const PASSWORD_RESET_TOKENS_REPOSITORY = Symbol(
  'PASSWORD_RESET_TOKENS_REPOSITORY',
);

/** Safe context recovered after a reset token hash has been matched. */
export type PasswordResetTokenRecord = {
  id: string;
  identityId: string;
  userId: string;
  workspaceId: string;
};

/** Persistence contract for expiring, replaceable, single-use reset tokens. */
export interface PasswordResetTokensRepository {
  /** Inserts an expiring reset record containing only the token hash. */
  create(input: {
    id: string;
    identityId: string;
    userId: string;
    workspaceId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  /** Invalidates every still-open reset token for one user. */
  invalidateOpenForUser(userId: string, invalidatedAt: Date): Promise<void>;
  /** Finds a matching reset token only while it is open and unexpired. */
  findUsableByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<PasswordResetTokenRecord | null>;
  /** Conditionally consumes one usable reset token exactly once. */
  consume(id: string, consumedAt: Date): Promise<boolean>;
  /** Records only the coarse immediate mail-delivery outcome. */
  markDelivery(
    id: string,
    status: 'SENT' | 'FAILED',
    attemptedAt: Date,
  ): Promise<void>;
}
