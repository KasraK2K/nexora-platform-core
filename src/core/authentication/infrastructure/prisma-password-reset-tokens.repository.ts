import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../persistence/database-context';
import type {
  PasswordResetTokenRecord,
  PasswordResetTokensRepository,
} from '../application/password-reset-tokens';

const recordSelection = {
  id: true,
  identityId: true,
  userId: true,
  workspaceId: true,
} as const;

/** Prisma adapter for Authentication-owned password-reset records. */
@Injectable()
export class PrismaPasswordResetTokensRepository implements PasswordResetTokensRepository {
  constructor(private readonly database: DatabaseContext) {}

  /** Inserts a hashed reset record through the current database client. */
  async create(input: {
    id: string;
    identityId: string;
    userId: string;
    workspaceId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.database.client.passwordResetToken.create({ data: input });
  }

  /** Invalidates all still-open reset tokens for one user. */
  async invalidateOpenForUser(
    userId: string,
    invalidatedAt: Date,
  ): Promise<void> {
    await this.database.client.passwordResetToken.updateMany({
      where: { userId, consumedAt: null, invalidatedAt: null },
      data: { invalidatedAt },
    });
  }

  /** Selects a token only when it is unconsumed, valid, and unexpired. */
  findUsableByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<PasswordResetTokenRecord | null> {
    return this.database.client.passwordResetToken.findFirst({
      where: {
        tokenHash,
        consumedAt: null,
        invalidatedAt: null,
        expiresAt: { gt: now },
      },
      select: recordSelection,
    });
  }

  /** Conditionally consumes one still-usable record to enforce single use. */
  async consume(id: string, consumedAt: Date): Promise<boolean> {
    const result = await this.database.client.passwordResetToken.updateMany({
      where: {
        id,
        consumedAt: null,
        invalidatedAt: null,
        expiresAt: { gt: consumedAt },
      },
      data: { consumedAt },
    });
    return result.count === 1;
  }

  /** Records the latest immediate mail-delivery outcome. */
  async markDelivery(
    id: string,
    status: 'SENT' | 'FAILED',
    attemptedAt: Date,
  ): Promise<void> {
    await this.database.client.passwordResetToken.update({
      where: { id },
      data: { deliveryStatus: status, deliveryAttemptedAt: attemptedAt },
    });
  }
}
