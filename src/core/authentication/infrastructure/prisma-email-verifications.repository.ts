import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../persistence/database-context';
import type {
  EmailVerificationRecord,
  EmailVerificationsRepository,
} from '../application/email-verifications';

const recordSelection = {
  id: true,
  userId: true,
  workspaceId: true,
} as const;

@Injectable()
export class PrismaEmailVerificationsRepository implements EmailVerificationsRepository {
  constructor(private readonly database: DatabaseContext) {}

  async create(input: {
    id: string;
    userId: string;
    workspaceId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.database.client.emailVerification.create({ data: input });
  }

  async invalidateOpenForUser(
    userId: string,
    invalidatedAt: Date,
  ): Promise<void> {
    await this.database.client.emailVerification.updateMany({
      where: { userId, consumedAt: null, invalidatedAt: null },
      data: { invalidatedAt },
    });
  }

  findUsableByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<EmailVerificationRecord | null> {
    return this.database.client.emailVerification.findFirst({
      where: {
        tokenHash,
        consumedAt: null,
        invalidatedAt: null,
        expiresAt: { gt: now },
      },
      select: recordSelection,
    });
  }

  findLatestForUser(userId: string): Promise<EmailVerificationRecord | null> {
    return this.database.client.emailVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: recordSelection,
    });
  }

  async consume(id: string, consumedAt: Date): Promise<boolean> {
    const result = await this.database.client.emailVerification.updateMany({
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
    await this.database.client.emailVerification.update({
      where: { id },
      data: { deliveryStatus: status, deliveryAttemptedAt: attemptedAt },
    });
  }
}
