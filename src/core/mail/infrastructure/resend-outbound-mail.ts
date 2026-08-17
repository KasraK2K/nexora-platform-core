import { Inject, Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { AppConfig } from '../../configuration/app-config';
import type { OutboundMail } from '../application/outbound-mail.port';

/** Sends text email through Resend while keeping SDK details at the edge. */
@Injectable()
export class ResendOutboundMail implements OutboundMail {
  private readonly resend: Resend;

  constructor(
    @Inject(AppConfig)
    private readonly config: Pick<
      AppConfig,
      'emailFrom' | 'resendApiKey' | 'resendTimeoutMs'
    >,
  ) {
    this.resend = new Resend(config.resendApiKey);
  }

  /** Sends one message with a bounded request and provider-side deduplication. */
  async send(input: {
    to: string;
    subject: string;
    text: string;
    messageId?: string;
  }): Promise<void> {
    const requestOptions = {
      idempotencyKey: input.messageId,
      signal: AbortSignal.timeout(this.config.resendTimeoutMs),
    };
    const { error } = await this.resend.emails.send(
      {
        from: this.config.emailFrom,
        to: input.to,
        subject: input.subject,
        text: input.text,
      },
      requestOptions,
    );

    if (error) throw new Error('Resend rejected the outbound email.');
  }
}
