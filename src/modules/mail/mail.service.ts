import { Inject, Injectable } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { currentRequestContext } from '../../common/request-context';
import type { MailPurpose } from './mail.types';
import { MailOutboxRepository } from './repositories/mail-outbox.repository';
import {
  MAIL_PAYLOAD_PROTECTOR,
  type MailPayloadProtector,
} from './security/mail-payload-protector';

type ProtectedMailPayload = Readonly<{
  to: string;
  subject: string;
  text: string;
}>;

/**
 * Durable, encrypted handoff for Core email. Callers enqueue while their
 * business transaction is active; a private worker-side service owns delivery.
 */
@Injectable()
export class MailService {
  constructor(
    private readonly repository: MailOutboxRepository,
    @Inject(MAIL_PAYLOAD_PROTECTOR)
    private readonly protector: MailPayloadProtector,
    private readonly config: AppConfig,
  ) {}

  /**
   * Encrypts and idempotently records one message. Call this while the owning
   * business transaction is active so the business fact and mail handoff commit
   * together; this method does not contact the delivery provider.
   */
  async enqueue(input: {
    id: string;
    workspaceId: string;
    purpose: MailPurpose;
    to: string;
    subject: string;
    text: string;
    expiresAt: Date;
  }): Promise<void> {
    const messageId = `<${input.id}@${this.config.emailMessageIdDomain}>`;
    const payload: ProtectedMailPayload = {
      to: input.to,
      subject: input.subject,
      text: input.text,
    };
    const correlationId = currentRequestContext()?.correlationId ?? input.id;
    await this.repository.create({
      id: input.id,
      workspaceId: input.workspaceId,
      purpose: input.purpose,
      idempotencyKey: `${input.purpose}:${input.id}`,
      messageId,
      encryptedPayload: this.protector.protect(
        input.id,
        JSON.stringify(payload),
      ),
      correlationId,
      expiresAt: input.expiresAt,
    });
  }
}
