import { Inject, Injectable } from '@nestjs/common';

export const EMAIL_VERIFICATIONS_REPOSITORY = Symbol(
  'EMAIL_VERIFICATIONS_REPOSITORY',
);

export type EmailVerificationRecord = {
  id: string;
  userId: string;
  workspaceId: string;
};

export interface EmailVerificationsRepository {
  create(input: {
    id: string;
    userId: string;
    workspaceId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  invalidateOpenForUser(userId: string, invalidatedAt: Date): Promise<void>;
  findUsableByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<EmailVerificationRecord | null>;
  findLatestForUser(userId: string): Promise<EmailVerificationRecord | null>;
  consume(id: string, consumedAt: Date): Promise<boolean>;
  markDelivery(
    id: string,
    status: 'SENT' | 'FAILED',
    attemptedAt: Date,
  ): Promise<void>;
}

@Injectable()
export class EmailVerifications {
  constructor(
    @Inject(EMAIL_VERIFICATIONS_REPOSITORY)
    private readonly repository: EmailVerificationsRepository,
  ) {}

  create(input: {
    id: string;
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
  ): Promise<EmailVerificationRecord | null> {
    return this.repository.findUsableByTokenHash(tokenHash, now);
  }

  findLatestForUser(userId: string): Promise<EmailVerificationRecord | null> {
    return this.repository.findLatestForUser(userId);
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
