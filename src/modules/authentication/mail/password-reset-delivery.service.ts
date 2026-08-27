import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config';
import { MailService } from '../../mail/mail.service';

/** Writes password-reset mail to the durable outbox for asynchronous delivery. */
@Injectable()
export class PasswordResetDeliveryService {
  constructor(
    private readonly outbox: MailService,
    private readonly config: AppConfig,
  ) {}

  /**
   * Enqueues mail using the reset ID as the outbox ID. Callers place this write
   * in the same transaction as token creation.
   */
  async enqueue(input: {
    resetId: string;
    workspaceId: string;
    email: string;
    token: string;
    expiresAt: Date;
  }): Promise<void> {
    const url = new URL(this.config.passwordResetUrl);
    url.hash = `token=${encodeURIComponent(input.token)}`;
    await this.outbox.enqueue({
      id: input.resetId,
      workspaceId: input.workspaceId,
      purpose: 'PASSWORD_RESET',
      to: input.email,
      subject: 'Reset your password',
      text: [
        'Reset your password by opening this link:',
        url.toString(),
        `This link expires at ${input.expiresAt.toISOString()}.`,
        'If you did not request a password reset, you can ignore this email.',
      ].join('\n\n'),
      expiresAt: input.expiresAt,
    });
  }
}
