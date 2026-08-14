import { Inject, Injectable } from '@nestjs/common';

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
  /** Invalidates every still-open reset token for a user. */
  invalidateOpenForUser(userId: string, invalidatedAt: Date): Promise<void>;
  /** Finds a matching token only while it is open and unexpired. */
  findUsableByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<PasswordResetTokenRecord | null>;
  /** Conditionally consumes one usable record, returning whether this call won. */
  consume(id: string, consumedAt: Date): Promise<boolean>;
  /** Records the latest immediate mail-delivery outcome. */
  markDelivery(
    id: string,
    status: 'SENT' | 'FAILED',
    attemptedAt: Date,
  ): Promise<void>;
}

/** Application-facing gateway to password-reset token state. */
@Injectable()
export class PasswordResetTokens {
  constructor(
    @Inject(PASSWORD_RESET_TOKENS_REPOSITORY)
    private readonly repository: PasswordResetTokensRepository,
  ) {}

  /** Persists a hashed reset token; the surrounding use case owns the transaction. */
  create(input: {
    id: string;
    identityId: string;
    userId: string;
    workspaceId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    return this.repository.create(input);
  }

  /** Invalidates every unconsumed reset link for a user. */
  invalidateOpenForUser(userId: string, invalidatedAt: Date): Promise<void> {
    return this.repository.invalidateOpenForUser(userId, invalidatedAt);
  }

  /** Finds a matching reset only while it remains open and unexpired. */
  findUsableByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<PasswordResetTokenRecord | null> {
    return this.repository.findUsableByTokenHash(tokenHash, now);
  }

  /** Atomically consumes an open, unexpired reset token exactly once. */
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
