import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { AppConfig } from '../../configuration/app-config';
import type { OutboundMail } from '../application/outbound-mail.port';

/** Sends text email through a hardened Nodemailer SMTP transport. */
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

  /** Sends one message while forbidding file and URL content loading. */
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

  /** Closes pooled SMTP resources during application shutdown. */
  onApplicationShutdown(): void {
    this.transporter.close();
  }
}
