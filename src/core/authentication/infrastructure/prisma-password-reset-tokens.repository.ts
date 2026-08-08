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

@Injectable()
export class PrismaPasswordResetTokensRepository implements PasswordResetTokensRepository {
  constructor(private readonly database: DatabaseContext) {}

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

  async invalidateOpenForUser(
    userId: string,
    invalidatedAt: Date,
  ): Promise<void> {
    await this.database.client.passwordResetToken.updateMany({
      where: { userId, consumedAt: null, invalidatedAt: null },
      data: { invalidatedAt },
    });
  }

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
