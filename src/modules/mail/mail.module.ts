import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { OUTBOUND_MAIL } from './providers/outbound-mail';
import { MailOutboxRepository } from './repositories/mail-outbox.repository';
import { MailService } from './mail.service';
import { MAIL_PAYLOAD_PROTECTOR } from './security/mail-payload-protector';
import { ObservabilityModule } from '../observability/observability.module';
import { AesGcmMailPayloadProtector } from './security/aes-gcm-mail-payload-protector';
import { MailOutboxWorker } from './worker/mail-outbox.worker';
import { ResendOutboundMail } from './providers/resend-outbound-mail';

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
    MailOutboxRepository,
    { provide: OUTBOUND_MAIL, useExisting: ResendOutboundMail },
    {
      provide: MAIL_PAYLOAD_PROTECTOR,
      useExisting: AesGcmMailPayloadProtector,
    },
  ],
  exports: [MailService],
})
export class MailModule {}
