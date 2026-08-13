import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { AppConfig } from '../../configuration/app-config';
import type { OutboundMail } from '../application/outbound-mail.port';

@Injectable()
export class SmtpOutboundMail implements OutboundMail, OnApplicationShutdown {
  private readonly transporter: Transporter;

  constructor(private readonly config: AppConfig) {
    this.transporter = createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      requireTLS: config.smtpRequireTls,
      tls: { rejectUnauthorized: true },
      disableFileAccess: true,
      disableUrlAccess: true,
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
    subject: string;
    text: string;
    messageId?: string;
  }): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.emailFrom,
      ...input,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }

  onApplicationShutdown(): void {
    this.transporter.close();
  }
}
