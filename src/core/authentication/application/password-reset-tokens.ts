import { Inject, Injectable } from '@nestjs/common';

export const PASSWORD_RESET_TOKENS_REPOSITORY = Symbol(
  'PASSWORD_RESET_TOKENS_REPOSITORY',
);

export type PasswordResetTokenRecord = {
  id: string;
  identityId: string;
  userId: string;
  workspaceId: string;
};

export interface PasswordResetTokensRepository {
  create(input: {
    id: string;
    identityId: string;
    userId: string;
    workspaceId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  invalidateOpenForUser(userId: string, invalidatedAt: Date): Promise<void>;
  findUsableByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<PasswordResetTokenRecord | null>;
  consume(id: string, consumedAt: Date): Promise<boolean>;
  markDelivery(
    id: string,
    status: 'SENT' | 'FAILED',
    attemptedAt: Date,
  ): Promise<void>;
}

@Injectable()
export class PasswordResetTokens {
  constructor(
    @Inject(PASSWORD_RESET_TOKENS_REPOSITORY)
    private readonly repository: PasswordResetTokensRepository,
  ) {}

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

  invalidateOpenForUser(userId: string, invalidatedAt: Date): Promise<void> {
    return this.repository.invalidateOpenForUser(userId, invalidatedAt);
  }

  findUsableByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<PasswordResetTokenRecord | null> {
    return this.repository.findUsableByTokenHash(tokenHash, now);
  }

  consume(id: string, consumedAt: Date): Promise<boolean> {
    return this.repository.consume(id, consumedAt);
  }

  markDelivery(
    id: string,
    status: 'SENT' | 'FAILED',
    attemptedAt: Date,
  ): Promise<void> {
    return this.repository.markDelivery(id, status, attemptedAt);
  }
}
