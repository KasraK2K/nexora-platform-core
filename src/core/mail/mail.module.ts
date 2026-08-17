import { Module } from '@nestjs/common';
import { CoreInfrastructureModule } from '../core-infrastructure.module';
import { OUTBOUND_MAIL } from './application/outbound-mail.port';
import { MAIL_OUTBOX_REPOSITORY } from './application/mail-outbox.repository';
import { MailOutbox } from './application/mail-outbox';
import { MAIL_PAYLOAD_PROTECTOR } from './application/mail-payload-protector.port';
import { ObservabilityModule } from '../observability/observability.module';
import { AesGcmMailPayloadProtector } from './infrastructure/aes-gcm-mail-payload-protector';
import { MailOutboxWorker } from './infrastructure/mail-outbox.worker';
import { PrismaMailOutboxRepository } from './infrastructure/prisma-mail-outbox.repository';
import { ResendOutboundMail } from './infrastructure/resend-outbound-mail';

/**
 * Wires the provider-neutral mail contract to Resend and exports the durable
 * outbox used by Core workflows. Provider details stay inside this module.
 */
@Module({
  imports: [CoreInfrastructureModule, ObservabilityModule],
  providers: [
    ResendOutboundMail,
    MailOutbox,
    MailOutboxWorker,
    AesGcmMailPayloadProtector,
    PrismaMailOutboxRepository,
    { provide: OUTBOUND_MAIL, useExisting: ResendOutboundMail },
    {
      provide: MAIL_PAYLOAD_PROTECTOR,
      useExisting: AesGcmMailPayloadProtector,
    },
    {
      provide: MAIL_OUTBOX_REPOSITORY,
      useExisting: PrismaMailOutboxRepository,
    },
  ],
  exports: [OUTBOUND_MAIL, MailOutbox],
})
export class MailModule {}
