import type { MailOutboxRepository } from './repositories/mail-outbox.repository';
import type { MailPayloadProtector } from './security/mail-payload-protector';
import { MailService } from './mail.service';

describe('MailService delivery policy', () => {
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
    const [sent] = fixture.repository.markSent.mock.calls[0];
    expect(sent.id).toBe('delivery-id');
    expect(sent.attemptCount).toBe(1);
    expect(sent.sentAt).toBeInstanceOf(Date);
  });

  it('schedules a bounded exponential retry for a transient failure', async () => {
    const fixture = createFixture({ attemptCount: 2, sendFails: true });

    await expect(fixture.outbox.deliverNow('delivery-id')).resolves.toBe(false);

    expect(fixture.repository.markRetry.mock.calls).toHaveLength(1);
    const [retry] = fixture.repository.markRetry.mock.calls[0];
    expect(retry).toMatchObject({ id: 'delivery-id', attemptCount: 2 });
    expect(retry.nextAttemptAt.getTime() - retry.attemptedAt.getTime()).toBe(
      2_000,
    );
    expect(fixture.repository.markFailed.mock.calls).toHaveLength(0);
  });

  it('terminates after the configured attempt bound', async () => {
    const fixture = createFixture({ attemptCount: 3, sendFails: true });

    await expect(fixture.outbox.deliverNow('delivery-id')).resolves.toBe(false);

    expect(fixture.repository.markFailed.mock.calls).toHaveLength(1);
    const [failed] = fixture.repository.markFailed.mock.calls[0];
    expect(failed.id).toBe('delivery-id');
    expect(failed.attemptCount).toBe(3);
    expect(failed.failedAt).toBeInstanceOf(Date);
    expect(fixture.repository.markRetry.mock.calls).toHaveLength(0);
  });

  it('does not send when another worker owns the claim', async () => {
    const fixture = createFixture({ claimed: false });

    await expect(fixture.outbox.deliverNow('delivery-id')).resolves.toBe(false);
    expect(fixture.outboundMail.send.mock.calls).toHaveLength(0);
  });

  it('renews its fenced lease while provider delivery is still pending', async () => {
    jest.useFakeTimers();
    try {
      const fixture = createFixture({ deferredSend: true, claimTtlMs: 300 });
      const delivery = fixture.outbox.deliverNow('delivery-id');

      await jest.advanceTimersByTimeAsync(701);
      const renewalCount = fixture.repository.renewLease.mock.calls.length;
      fixture.releaseSend();

      await expect(delivery).resolves.toBe(true);
      expect(renewalCount).toBeGreaterThanOrEqual(3);
      expect(fixture.repository.markSent.mock.calls).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('never renews a provider lease past message expiry', async () => {
    jest.useFakeTimers();
    try {
      const fixture = createFixture({
        deferredSend: true,
        claimTtlMs: 300,
        expiresInMs: 150,
      });
      const delivery = fixture.outbox.deliverNow('delivery-id');

      await jest.advanceTimersByTimeAsync(101);
      const [lastRenewal] =
        fixture.repository.renewLease.mock.calls.at(-1) ?? [];
      fixture.releaseSend();

      if (!lastRenewal) throw new Error('Expected a lease renewal');
      expect(lastRenewal.lockedUntil).toEqual(fixture.claimedExpiresAt);
      await expect(delivery).resolves.toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('abandons completion when its lease heartbeat loses ownership', async () => {
    jest.useFakeTimers();
    try {
      const fixture = createFixture({
        deferredSend: true,
        claimTtlMs: 300,
        renewLeaseSucceeds: false,
      });
      const delivery = fixture.outbox.deliverNow('delivery-id');

      await jest.advanceTimersByTimeAsync(101);
      fixture.releaseSend();

      await expect(delivery).resolves.toBe(false);
      expect(fixture.repository.markSent.mock.calls).toHaveLength(0);
      expect(fixture.repository.markRetry.mock.calls).toHaveLength(0);
      expect(fixture.repository.markFailed.mock.calls).toHaveLength(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('abandons completion after its last known lease deadline', async () => {
    jest.useFakeTimers();
    try {
      const fixture = createFixture({ deferredSend: true, claimTtlMs: 300 });
      const delivery = fixture.outbox.deliverNow('delivery-id');
      await jest.advanceTimersByTimeAsync(0);

      jest.setSystemTime(Date.now() + 301);
      fixture.releaseSend();

      await expect(delivery).resolves.toBe(false);
      expect(fixture.repository.renewLease.mock.calls).toHaveLength(0);
      expect(fixture.repository.markSent.mock.calls).toHaveLength(0);
    } finally {
      jest.useRealTimers();
    }
  });

  function createFixture(options: {
    claimed?: boolean;
    attemptCount?: number;
    sendFails?: boolean;
    deferredSend?: boolean;
    claimTtlMs?: number;
    expiresInMs?: number;
    renewLeaseSucceeds?: boolean;
  }) {
    const claimTtlMs = options.claimTtlMs ?? 5_000;
    const claimedExpiresAt = new Date(
      Date.now() + (options.expiresInMs ?? 60_000),
    );
    const repository = {
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
              lockedUntil: new Date(Date.now() + claimTtlMs),
              expiresAt: claimedExpiresAt,
            },
      ),
      renewLease: jest
        .fn()
        .mockResolvedValue(options.renewLeaseSucceeds !== false),
      markSent: jest.fn(),
      markRetry: jest.fn(),
      markFailed: jest.fn(),
      expireDue: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<MailOutboxRepository>;
    const protector: MailPayloadProtector = {
      protect: (_id, plaintext) => plaintext,
      unprotect: () => payload,
    };
    let resolveSend: (() => void) | undefined;
    const outboundMail = {
      send: options.deferredSend
        ? jest.fn(
            () =>
              new Promise<void>((resolve) => {
                resolveSend = resolve;
              }),
          )
        : options.sendFails
          ? jest.fn().mockRejectedValue(new Error('provider secret'))
          : jest.fn().mockResolvedValue(undefined),
    };
    const telemetry = { recordMailDelivery: jest.fn() };
    return {
      repository,
      outboundMail,
      outbox: new MailService(
        repository,
        protector,
        outboundMail,
        {
          emailMessageIdDomain: 'mail.example.com',
          mailClaimTtlMs: claimTtlMs,
          mailMaxAttempts: 3,
          mailRetryBaseMs: 1_000,
          mailRetryMaxMs: 5_000,
        } as never,
        telemetry as never,
      ),
      releaseSend: () => {
        if (!resolveSend) throw new Error('Deferred send has not started');
        resolveSend();
      },
      claimedExpiresAt,
    };
  }
});
