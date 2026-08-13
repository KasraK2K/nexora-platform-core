import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../configuration/app-config';
import { MailOutbox } from '../../mail/application/mail-outbox';
import { Clock } from '../../../shared/application/clock';
import { EmailVerifications } from './email-verifications';

@Injectable()
export class EmailVerificationDelivery {
  constructor(
    private readonly outbox: MailOutbox,
    private readonly verifications: EmailVerifications,
    private readonly clock: Clock,
    private readonly config: AppConfig,
  ) {}

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

  async attempt(verificationId: string): Promise<boolean> {
    const sent = await this.outbox.deliverNow(verificationId);
    await this.verifications
      .markDelivery(verificationId, sent ? 'SENT' : 'FAILED', this.clock.now())
      .catch(() => undefined);
    return sent;
  }

  dispatch(verificationId: string): void {
    void this.attempt(verificationId).catch(() => undefined);
  }
}
