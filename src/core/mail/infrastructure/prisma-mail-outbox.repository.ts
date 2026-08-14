import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../persistence/database-context';
import type {
  ClaimedMail,
  MailOutboxRepository,
  MailPurpose,
} from '../application/mail-outbox.repository';

/** Implements the durable mail state machine in the Mail-owned Prisma table. */
@Injectable()
export class PrismaMailOutboxRepository implements MailOutboxRepository {
  constructor(private readonly database: DatabaseContext) {}

  /** Idempotently inserts a message and leaves an existing key unchanged. */
  async create(input: {
    id: string;
    workspaceId: string;
    purpose: MailPurpose;
    idempotencyKey: string;
    messageId: string;
    encryptedPayload: string;
    correlationId: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.database.client.mailOutboxMessage.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      create: input,
      update: {},
    });
  }

  /** Finds due pending messages and processing messages whose lease expired. */
  async findDueIds(now: Date, limit: number): Promise<string[]> {
    const messages = await this.database.client.mailOutboxMessage.findMany({
      where: {
        expiresAt: { gt: now },
        OR: [
          {
            status: { in: ['PENDING', 'RETRY_SCHEDULED'] },
            nextAttemptAt: { lte: now },
            lockedUntil: null,
          },
          { status: 'PROCESSING', lockedUntil: { lt: now } },
        ],
      },
      orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
      take: limit,
      select: { id: true },
    });
    return messages.map((message) => message.id);
  }

  /**
   * Atomically moves one eligible message to processing and increments its
   * attempt count. Returns `null` when the conditional update loses a race.
   */
  async claim(
    id: string,
    now: Date,
    lockedUntil: Date,
  ): Promise<ClaimedMail | null> {
    const result = await this.database.client.mailOutboxMessage.updateMany({
      where: {
        id,
        expiresAt: { gt: now },
        OR: [
          {
            status: { in: ['PENDING', 'RETRY_SCHEDULED'] },
            nextAttemptAt: { lte: now },
            lockedUntil: null,
          },
          { status: 'PROCESSING', lockedUntil: { lt: now } },
        ],
      },
      data: {
        status: 'PROCESSING',
        lockedUntil,
        lastAttemptAt: now,
        attemptCount: { increment: 1 },
      },
    });
    if (result.count !== 1) return null;
    return this.database.client.mailOutboxMessage.findUnique({
      where: { id },
      select: {
        id: true,
        encryptedPayload: true,
        messageId: true,
        correlationId: true,
        attemptCount: true,
        expiresAt: true,
      },
    });
  }

  /** Marks a processing row sent and erases its encrypted content. */
  async markSent(id: string, sentAt: Date): Promise<void> {
    const result = await this.database.client.mailOutboxMessage.updateMany({
      where: { id, status: 'PROCESSING' },
      data: {
        status: 'SENT',
        sentAt,
        lockedUntil: null,
        encryptedPayload: '',
      },
    });
    ensureUpdated(result.count);
  }

  /** Moves a processing row to its next attempt time. */
  async markRetry(
    id: string,
    attemptedAt: Date,
    nextAttemptAt: Date,
  ): Promise<void> {
    const result = await this.database.client.mailOutboxMessage.updateMany({
      where: { id, status: 'PROCESSING' },
      data: {
        status: 'RETRY_SCHEDULED',
        lastAttemptAt: attemptedAt,
        nextAttemptAt,
        lockedUntil: null,
      },
    });
    ensureUpdated(result.count);
  }

  /** Marks a processing row terminally failed and erases its encrypted content. */
  async markFailed(id: string, failedAt: Date): Promise<void> {
    const result = await this.database.client.mailOutboxMessage.updateMany({
      where: { id, status: 'PROCESSING' },
      data: {
        status: 'FAILED',
        failedAt,
        lockedUntil: null,
        encryptedPayload: '',
      },
    });
    ensureUpdated(result.count);
  }

  /** Fails expired pending/retry messages before they can be claimed. */
  async expireDue(now: Date): Promise<number> {
    const result = await this.database.client.mailOutboxMessage.updateMany({
      where: {
        status: { in: ['PENDING', 'RETRY_SCHEDULED'] },
        expiresAt: { lte: now },
      },
      data: { status: 'FAILED', failedAt: now, encryptedPayload: '' },
    });
    return result.count;
  }
}

/** Rejects an outbox transition that did not update exactly one processing row. */
function ensureUpdated(count: number): void {
  if (count !== 1) throw new Error('Mail outbox state transition failed');
}
