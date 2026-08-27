import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config';
import { MailService } from '../../mail/mail.service';

/** Writes verification mail to the durable outbox for asynchronous delivery. */
@Injectable()
export class EmailVerificationDeliveryService {
  constructor(
    private readonly outbox: MailService,
    private readonly config: AppConfig,
  ) {}

  /**
   * Enqueues mail using the verification ID as the outbox ID. Callers place
   * this write in the same transaction as token creation and audit records.
   */
  async enqueue(input: {
    verificationId: string;
    workspaceId: string;
    email: string;
    token: string;
    expiresAt: Date;
  }): Promise<void> {
    const url = new URL(this.config.emailVerificationUrl);
    url.hash = `token=${encodeURIComponent(input.token)}`;
    await this.outbox.enqueue({
      id: input.verificationId,
      workspaceId: input.workspaceId,
      purpose: 'EMAIL_VERIFICATION',
      to: input.email,
      subject: 'Verify your email address',
      text: [
        'Verify your email address by opening this link:',
        url.toString(),
        `This link expires at ${input.expiresAt.toISOString()}.`,
        'If you did not create this account, you can ignore this email.',
      ].join('\n\n'),
      expiresAt: input.expiresAt,
    });
  }
}
