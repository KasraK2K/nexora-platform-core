import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../../infrastructure/database/database-context';
import type { MailPurpose } from '../mail.types';

/** Encrypted message and retry state leased to one delivery attempt. */
export type ClaimedMail = Readonly<{
  id: string;
  encryptedPayload: string;
  messageId: string;
  correlationId: string;
  attemptCount: number;
  lockedUntil: Date;
  expiresAt: Date;
}>;

/** Private repository for the durable Mail-owned outbox state machine. */
@Injectable()
export class MailOutboxRepository {
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
  async findDueIds(
    now: Date,
    limit: number,
    maxAttempts: number,
  ): Promise<string[]> {
    const messages = await this.database.client.mailOutboxMessage.findMany({
      where: {
        expiresAt: { gt: now },
        attemptCount: { lt: maxAttempts },
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
    maxAttempts: number,
  ): Promise<ClaimedMail | null> {
    const claimed =
      await this.database.client.mailOutboxMessage.updateManyAndReturn({
        where: {
          id,
          expiresAt: { gt: now },
          attemptCount: { lt: maxAttempts },
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
        select: {
          id: true,
          encryptedPayload: true,
          messageId: true,
          correlationId: true,
          attemptCount: true,
          expiresAt: true,
        },
      });
    return claimed[0] ? { ...claimed[0], lockedUntil } : null;
  }

  /** Renews only the same live processing generation before message expiry. */
  async renewLease(input: {
    id: string;
    attemptCount: number;
    now: Date;
    lockedUntil: Date;
  }): Promise<boolean> {
    const result = await this.database.client.mailOutboxMessage.updateMany({
      where: {
        id: input.id,
        status: 'PROCESSING',
        attemptCount: input.attemptCount,
        expiresAt: { gt: input.now },
        lockedUntil: { gt: input.now },
      },
      data: { lockedUntil: input.lockedUntil },
    });
    return result.count === 1;
  }

  /** Completes only the currently fenced processing attempt as sent. */
  async markSent(input: {
    id: string;
    attemptCount: number;
    sentAt: Date;
  }): Promise<void> {
    const result = await this.database.client.mailOutboxMessage.updateMany({
      where: {
        id: input.id,
        status: 'PROCESSING',
        attemptCount: input.attemptCount,
      },
      data: {
        status: 'SENT',
        sentAt: input.sentAt,
        lockedUntil: null,
        encryptedPayload: '',
      },
    });
    ensureUpdated(result.count);
  }

  /** Reschedules only the currently fenced processing attempt. */
  async markRetry(input: {
    id: string;
    attemptCount: number;
    attemptedAt: Date;
    nextAttemptAt: Date;
  }): Promise<void> {
    const result = await this.database.client.mailOutboxMessage.updateMany({
      where: {
        id: input.id,
        status: 'PROCESSING',
        attemptCount: input.attemptCount,
      },
      data: {
        status: 'RETRY_SCHEDULED',
        lastAttemptAt: input.attemptedAt,
        nextAttemptAt: input.nextAttemptAt,
        lockedUntil: null,
      },
    });
    ensureUpdated(result.count);
  }

  /** Fails only the currently fenced processing attempt and erases its content. */
  async markFailed(input: {
    id: string;
    attemptCount: number;
    failedAt: Date;
  }): Promise<void> {
    const result = await this.database.client.mailOutboxMessage.updateMany({
      where: {
        id: input.id,
        status: 'PROCESSING',
        attemptCount: input.attemptCount,
      },
      data: {
        status: 'FAILED',
        failedAt: input.failedAt,
        lockedUntil: null,
        encryptedPayload: '',
      },
    });
    ensureUpdated(result.count);
  }

  /** Fails expired/exhausted rows, preserving any active processing lease. */
  async expireDue(now: Date, maxAttempts: number): Promise<number> {
    const result = await this.database.client.mailOutboxMessage.updateMany({
      where: {
        OR: [
          {
            status: { in: ['PENDING', 'RETRY_SCHEDULED'] },
            OR: [
              { expiresAt: { lte: now } },
              { attemptCount: { gte: maxAttempts } },
            ],
          },
          {
            status: 'PROCESSING',
            AND: [
              {
                OR: [
                  { expiresAt: { lte: now } },
                  { attemptCount: { gte: maxAttempts } },
                ],
              },
              {
                OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
              },
            ],
          },
        ],
      },
      data: {
        status: 'FAILED',
        failedAt: now,
        lockedUntil: null,
        encryptedPayload: '',
      },
    });
    return result.count;
  }
}

/** Rejects an outbox transition that did not update exactly one processing row. */
function ensureUpdated(count: number): void {
  if (count !== 1) throw new Error('Mail outbox state transition failed');
}
