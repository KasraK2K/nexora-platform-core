import { Module } from '@nestjs/common';
import { CoreInfrastructureModule } from '../core-infrastructure.module';
import { OUTBOUND_MAIL } from './application/outbound-mail.port';
import { SmtpOutboundMail } from './infrastructure/smtp-outbound-mail';

@Module({
  imports: [CoreInfrastructureModule],
  providers: [
    SmtpOutboundMail,
    { provide: OUTBOUND_MAIL, useExisting: SmtpOutboundMail },
  ],
  exports: [OUTBOUND_MAIL],
})
export class MailModule {}
