import { Injectable } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { AppConfig } from '../../configuration/app-config';

@Injectable()
export class SmtpMailTransport {
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
    subject: string;
    text: string;
  }): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.emailFrom,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
  }
}
