import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { OUTBOUND_MAIL } from './ports/outbound-mail.port';
import { MAIL_OUTBOX_REPOSITORY } from './repositories/mail-outbox.repository';
import { MailService } from './mail.service';
import { MAIL_PAYLOAD_PROTECTOR } from './ports/mail-payload-protector.port';
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
  imports: [InfrastructureModule, ObservabilityModule],
  providers: [
    ResendOutboundMail,
    MailService,
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
  exports: [MailService],
})
export class MailModule {}
