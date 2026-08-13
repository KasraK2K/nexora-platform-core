import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../configuration/app-config';
import { MailOutbox } from '../../mail/application/mail-outbox';
import { Clock } from '../../../shared/application/clock';
import { PasswordResetTokens } from './password-reset-tokens';

@Injectable()
export class PasswordResetDelivery {
  constructor(
    private readonly outbox: MailOutbox,
    private readonly tokens: PasswordResetTokens,
    private readonly clock: Clock,
    private readonly config: AppConfig,
  ) {}

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

  async attempt(resetId: string): Promise<boolean> {
    const sent = await this.outbox.deliverNow(resetId);
    await this.tokens
      .markDelivery(resetId, sent ? 'SENT' : 'FAILED', this.clock.now())
      .catch(() => undefined);
    return sent;
  }

  dispatch(resetId: string): void {
    void this.attempt(resetId).catch(() => undefined);
  }
}
