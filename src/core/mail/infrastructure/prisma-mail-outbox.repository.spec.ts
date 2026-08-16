import { DatabaseContext } from '../../persistence/database-context';
import type { ClaimedMail } from '../application/mail-outbox.repository';
import { PrismaMailOutboxRepository } from './prisma-mail-outbox.repository';

describe('PrismaMailOutboxRepository', () => {
  it('returns only the generation produced by the atomic claim statement', async () => {
    const claimed = {
      id: 'delivery-id',
      encryptedPayload: 'protected',
      messageId: '<delivery-id@mail.example.test>',
      correlationId: 'correlation-id',
      attemptCount: 2,
      lockedUntil: new Date('2099-01-02T00:01:00.000Z'),
      expiresAt: new Date('2099-01-03T00:00:00.000Z'),
    } satisfies ClaimedMail;
    const updateManyAndReturn = jest
      .fn()
      .mockResolvedValueOnce([claimed])
      .mockResolvedValueOnce([]);
    const repository = new PrismaMailOutboxRepository({
      client: { mailOutboxMessage: { updateManyAndReturn } },
    } as unknown as DatabaseContext);
    const now = new Date('2099-01-02T00:00:00.000Z');
    const lockedUntil = new Date('2099-01-02T00:01:00.000Z');

    await expect(
      repository.claim('delivery-id', now, lockedUntil, 3),
    ).resolves.toEqual(claimed);
    await expect(
      repository.claim('lost-race-id', now, lockedUntil, 3),
    ).resolves.toBeNull();
    expect(updateManyAndReturn.mock.calls).toHaveLength(2);
  });
});
