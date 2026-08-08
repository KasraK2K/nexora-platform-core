import { Injectable } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { AppConfig } from '../../configuration/app-config';
import type { EmailVerificationSender } from '../application/email-verification-sender.port';

@Injectable()
export class SmtpEmailVerificationSender implements EmailVerificationSender {
  private readonly transporter: Transporter;

  constructor(private readonly config: AppConfig) {
    this.transporter = createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      connectionTimeout: config.smtpTimeoutMs,
      greetingTimeout: config.smtpTimeoutMs,
      socketTimeout: config.smtpTimeoutMs,
      auth: config.smtpUser
        ? { user: config.smtpUser, pass: config.smtpPassword }
        : undefined,
    });
  }

  async send(input: {
    to: string;
    token: string;
    expiresAt: Date;
  }): Promise<void> {
    const verificationUrl = new URL(this.config.emailVerificationUrl);
    verificationUrl.searchParams.set('token', input.token);

    await this.transporter.sendMail({
      from: this.config.emailFrom,
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
