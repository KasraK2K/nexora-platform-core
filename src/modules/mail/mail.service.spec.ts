import { runWithRequestContext } from '../../common/request-context';
import type { MailOutboxRepository } from './repositories/mail-outbox.repository';
import type { MailPayloadProtector } from './security/mail-payload-protector';
import { MailService } from './mail.service';

describe('MailService', () => {
  it('encrypts and idempotently enqueues the complete durable handoff', async () => {
    const repository = {
      create: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MailOutboxRepository>;
    const protector = {
      protect: jest.fn().mockReturnValue('encrypted-payload'),
      unprotect: jest.fn(),
    } satisfies MailPayloadProtector;
    const service = new MailService(repository, protector, {
      emailMessageIdDomain: 'mail.example.com',
    } as never);
    const expiresAt = new Date('2030-01-02T03:04:05.000Z');

    await runWithRequestContext(
      { requestId: 'request-id', correlationId: 'correlation-id' },
      () =>
        service.enqueue({
          id: 'delivery-id',
          workspaceId: 'workspace-id',
          purpose: 'EMAIL_VERIFICATION',
          to: 'person@example.com',
          subject: 'Subject',
          text: 'Body',
          expiresAt,
        }),
    );

    expect(protector.protect).toHaveBeenCalledWith(
      'delivery-id',
      JSON.stringify({
        to: 'person@example.com',
        subject: 'Subject',
        text: 'Body',
      }),
    );
    expect(repository.create.mock.calls).toEqual([
      [
        {
          id: 'delivery-id',
          workspaceId: 'workspace-id',
          purpose: 'EMAIL_VERIFICATION',
          idempotencyKey: 'EMAIL_VERIFICATION:delivery-id',
          messageId: '<delivery-id@mail.example.com>',
          encryptedPayload: 'encrypted-payload',
          correlationId: 'correlation-id',
          expiresAt,
        },
      ],
    ]);
  });

  it('uses the delivery ID as correlation outside a request', async () => {
    const repository = {
      create: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MailOutboxRepository>;
    const protector = {
      protect: jest.fn().mockReturnValue('encrypted-payload'),
      unprotect: jest.fn(),
    } satisfies MailPayloadProtector;
    const service = new MailService(repository, protector, {
      emailMessageIdDomain: 'mail.example.com',
    } as never);

    await service.enqueue({
      id: 'delivery-id',
      workspaceId: 'workspace-id',
      purpose: 'PASSWORD_RESET',
      to: 'person@example.com',
      subject: 'Subject',
      text: 'Body',
      expiresAt: new Date('2030-01-02T03:04:05.000Z'),
    });

    expect(repository.create.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ correlationId: 'delivery-id' }),
    );
  });
});
