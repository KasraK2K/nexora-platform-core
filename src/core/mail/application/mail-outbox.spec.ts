import type { MailOutboxRepository } from './mail-outbox.repository';
import type { MailPayloadProtector } from './mail-payload-protector.port';
import { MailOutbox } from './mail-outbox';

describe('MailOutbox delivery policy', () => {
  const payload = JSON.stringify({
    to: 'person@example.com',
    subject: 'Subject',
    text: 'Body',
  });

  it('marks a successful claimed message sent', async () => {
    const fixture = createFixture({ attemptCount: 1 });

    await expect(fixture.outbox.deliverNow('delivery-id')).resolves.toBe(true);

    expect(fixture.outboundMail.send.mock.calls).toEqual([
      [
        {
          to: 'person@example.com',
          subject: 'Subject',
          text: 'Body',
          messageId: '<delivery-id@mail.example.com>',
        },
      ],
    ]);
    expect(fixture.repository.markSent.mock.calls).toHaveLength(1);
  });

  it('schedules a bounded exponential retry for a transient failure', async () => {
    const fixture = createFixture({ attemptCount: 2, sendFails: true });

    await expect(fixture.outbox.deliverNow('delivery-id')).resolves.toBe(false);

    expect(fixture.repository.markRetry.mock.calls).toHaveLength(1);
    const [, attemptedAt, nextAttemptAt] =
      fixture.repository.markRetry.mock.calls[0];
    expect(nextAttemptAt.getTime() - attemptedAt.getTime()).toBe(2_000);
    expect(fixture.repository.markFailed.mock.calls).toHaveLength(0);
  });

  it('terminates after the configured attempt bound', async () => {
    const fixture = createFixture({ attemptCount: 3, sendFails: true });

    await expect(fixture.outbox.deliverNow('delivery-id')).resolves.toBe(false);

    expect(fixture.repository.markFailed.mock.calls).toHaveLength(1);
    expect(fixture.repository.markRetry.mock.calls).toHaveLength(0);
  });

  it('does not send when another worker owns the claim', async () => {
    const fixture = createFixture({ claimed: false });

    await expect(fixture.outbox.deliverNow('delivery-id')).resolves.toBe(false);
    expect(fixture.outboundMail.send.mock.calls).toHaveLength(0);
  });

  function createFixture(options: {
    claimed?: boolean;
    attemptCount?: number;
    sendFails?: boolean;
  }) {
    const repository: jest.Mocked<MailOutboxRepository> = {
      create: jest.fn(),
      findDueIds: jest.fn().mockResolvedValue([]),
      claim: jest.fn().mockResolvedValue(
        options.claimed === false
          ? null
          : {
              id: 'delivery-id',
              encryptedPayload: 'protected',
              messageId: '<delivery-id@mail.example.com>',
              correlationId: 'correlation-id',
              attemptCount: options.attemptCount ?? 1,
              expiresAt: new Date(Date.now() + 60_000),
            },
      ),
      markSent: jest.fn(),
      markRetry: jest.fn(),
      markFailed: jest.fn(),
      expireDue: jest.fn().mockResolvedValue(0),
    };
    const protector: MailPayloadProtector = {
      protect: (_id, plaintext) => plaintext,
      unprotect: () => payload,
    };
    const outboundMail = {
      send: options.sendFails
        ? jest.fn().mockRejectedValue(new Error('provider secret'))
        : jest.fn().mockResolvedValue(undefined),
    };
    const telemetry = { recordMailDelivery: jest.fn() };
    return {
      repository,
      outboundMail,
      outbox: new MailOutbox(
        repository,
        protector,
        outboundMail,
        {
          emailMessageIdDomain: 'mail.example.com',
          mailClaimTtlMs: 5_000,
          mailMaxAttempts: 3,
          mailRetryBaseMs: 1_000,
          mailRetryMaxMs: 5_000,
        } as never,
        telemetry as never,
      ),
    };
  }
});
