import { Inject, Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config';
import { MailService } from '../../mail/mail.service';
import { Clock } from '../../../common/application/clock';
import {
  EMAIL_VERIFICATIONS_REPOSITORY,
  type EmailVerificationsRepository,
} from '../repositories/email-verifications.repository';

/** Writes verification mail to the durable outbox and triggers immediate delivery. */
@Injectable()
export class EmailVerificationDelivery {
  constructor(
    private readonly outbox: MailService,
    @Inject(EMAIL_VERIFICATIONS_REPOSITORY)
    private readonly verifications: EmailVerificationsRepository,
    private readonly clock: Clock,
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

  /** Attempts delivery now and best-effort records whether it was sent. */
  async attempt(verificationId: string): Promise<boolean> {
    const sent = await this.outbox.deliverNow(verificationId);
    await this.verifications
      .markDelivery(verificationId, sent ? 'SENT' : 'FAILED', this.clock.now())
      .catch(() => undefined);
    return sent;
  }

  /** Starts a non-blocking delivery attempt after the durable transaction commits. */
  dispatch(verificationId: string): void {
    void this.attempt(verificationId).catch(() => undefined);
  }
}
