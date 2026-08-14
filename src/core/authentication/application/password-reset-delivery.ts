import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../configuration/app-config';
import { MailOutbox } from '../../mail/application/mail-outbox';
import { Clock } from '../../../shared/application/clock';
import { PasswordResetTokens } from './password-reset-tokens';

/** Writes password-reset mail to the durable outbox and triggers immediate delivery. */
@Injectable()
export class PasswordResetDelivery {
  constructor(
    private readonly outbox: MailOutbox,
    private readonly tokens: PasswordResetTokens,
    private readonly clock: Clock,
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

  /** Attempts delivery now and best-effort records whether it was sent. */
  async attempt(resetId: string): Promise<boolean> {
    const sent = await this.outbox.deliverNow(resetId);
    await this.tokens
      .markDelivery(resetId, sent ? 'SENT' : 'FAILED', this.clock.now())
      .catch(() => undefined);
    return sent;
  }

  /** Starts a non-blocking delivery attempt after the durable transaction commits. */
  dispatch(resetId: string): void {
    void this.attempt(resetId).catch(() => undefined);
  }
}
