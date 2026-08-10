import { Inject, Injectable } from '@nestjs/common';
import { AppConfig } from '../../configuration/app-config';
import {
  OUTBOUND_MAIL,
  type OutboundMail,
} from '../../mail/application/outbound-mail.port';
import type { EmailVerificationSender } from '../application/email-verification-sender.port';

@Injectable()
export class SmtpEmailVerificationSender implements EmailVerificationSender {
  constructor(
    private readonly config: AppConfig,
    @Inject(OUTBOUND_MAIL) private readonly mail: OutboundMail,
  ) {}

  async send(input: {
    to: string;
    token: string;
    expiresAt: Date;
  }): Promise<void> {
    const verificationUrl = new URL(this.config.emailVerificationUrl);
    verificationUrl.searchParams.set('token', input.token);

    await this.mail.send({
      to: input.to,
      subject: 'Verify your email address',
      text: [
        'Verify your email address by opening this link:',
        verificationUrl.toString(),
        `This link expires at ${input.expiresAt.toISOString()}.`,
        'If you did not create this account, you can ignore this email.',
      ].join('\n\n'),
    });
  }
}
