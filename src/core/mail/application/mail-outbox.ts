import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../configuration/app-config';
import { OperationalTelemetry } from '../../observability/application/operational-telemetry';
import { currentRequestContext } from '../../../shared/application/request-context';
import { OUTBOUND_MAIL, type OutboundMail } from './outbound-mail.port';
import {
  MAIL_OUTBOX_REPOSITORY,
  type MailOutboxRepository,
  type MailPurpose,
} from './mail-outbox.repository';
import {
  MAIL_PAYLOAD_PROTECTOR,
  type MailPayloadProtector,
} from './mail-payload-protector.port';

type ProtectedMailPayload = Readonly<{
  to: string;
  subject: string;
  text: string;
}>;

@Injectable()
export class MailOutbox {
  private readonly logger = new Logger(MailOutbox.name);

  constructor(
    @Inject(MAIL_OUTBOX_REPOSITORY)
    private readonly repository: MailOutboxRepository,
    @Inject(MAIL_PAYLOAD_PROTECTOR)
    private readonly protector: MailPayloadProtector,
    @Inject(OUTBOUND_MAIL) private readonly outboundMail: OutboundMail,
    private readonly config: AppConfig,
    private readonly telemetry: OperationalTelemetry,
  ) {}

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

  async deliverNow(id: string): Promise<boolean> {
    const now = new Date();
    let claimed;
    try {
      claimed = await this.repository.claim(
        id,
        now,
        new Date(now.getTime() + this.config.mailClaimTtlMs),
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'mail.delivery_claim_failed',
          deliveryId: id,
          errorType: error instanceof Error ? error.name : 'UnknownError',
        }),
      );
      return false;
    }
    if (!claimed) return false;

    try {
      const payload = readPayload(
        this.protector.unprotect(claimed.id, claimed.encryptedPayload),
      );
      await this.outboundMail.send({
        ...payload,
        messageId: claimed.messageId,
      });
      await this.repository.markSent(claimed.id, new Date());
      this.telemetry.recordMailDelivery('sent');
      return true;
    } catch (error) {
      const attemptedAt = new Date();
      try {
        if (
          claimed.attemptCount >= this.config.mailMaxAttempts ||
          claimed.expiresAt <= attemptedAt
        ) {
          await this.repository.markFailed(claimed.id, attemptedAt);
          this.telemetry.recordMailDelivery('failed');
        } else {
          const delay = Math.min(
            this.config.mailRetryMaxMs,
            this.config.mailRetryBaseMs * 2 ** (claimed.attemptCount - 1),
          );
          await this.repository.markRetry(
            claimed.id,
            attemptedAt,
            new Date(attemptedAt.getTime() + delay),
          );
          this.telemetry.recordMailDelivery('retry');
        }
      } catch (stateError) {
        this.logger.error(
          JSON.stringify({
            event: 'mail.delivery_state_update_failed',
            deliveryId: claimed.id,
            correlationId: claimed.correlationId,
            errorType:
              stateError instanceof Error ? stateError.name : 'UnknownError',
          }),
        );
      }
      this.logger.warn(
        JSON.stringify({
          event: 'mail.delivery_attempt_failed',
          deliveryId: claimed.id,
          correlationId: claimed.correlationId,
          attempt: claimed.attemptCount,
          errorType: error instanceof Error ? error.name : 'UnknownError',
        }),
      );
      return false;
    }
  }

  async drainDue(limit = 20): Promise<void> {
    const now = new Date();
    await this.repository.expireDue(now);
    const ids = await this.repository.findDueIds(now, limit);
    for (const id of ids) await this.deliverNow(id);
  }
}

function readPayload(value: string): ProtectedMailPayload {
  const parsed: unknown = JSON.parse(value);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('to' in parsed) ||
    typeof parsed.to !== 'string' ||
    !('subject' in parsed) ||
    typeof parsed.subject !== 'string' ||
    !('text' in parsed) ||
    typeof parsed.text !== 'string'
  ) {
    throw new Error('Invalid protected mail payload');
  }
  return { to: parsed.to, subject: parsed.subject, text: parsed.text };
}
