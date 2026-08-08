import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../configuration/app-config';
import type { PasswordResetSender } from '../application/password-reset-sender.port';
import { SmtpMailTransport } from './smtp-mail.transport';

@Injectable()
export class SmtpPasswordResetSender implements PasswordResetSender {
  constructor(
    private readonly config: AppConfig,
    private readonly transport: SmtpMailTransport,
  ) {}

  async send(input: {
    to: string;
    token: string;
    expiresAt: Date;
  }): Promise<void> {
    const resetUrl = new URL(this.config.passwordResetUrl);
    resetUrl.searchParams.set('token', input.token);

    await this.transport.send({
      to: input.to,
      subject: 'Reset your password',
      text: [
        'Reset your password by opening this link:',
        resetUrl.toString(),
        `This link expires at ${input.expiresAt.toISOString()}.`,
        'If you did not request a password reset, you can ignore this email.',
      ].join('\n\n'),
    });
  }
}
