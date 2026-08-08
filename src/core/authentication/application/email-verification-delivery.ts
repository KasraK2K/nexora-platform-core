import { Inject, Injectable } from '@nestjs/common';
import { Clock } from '../../../shared/application/clock';
import {
  EMAIL_VERIFICATION_SENDER,
  type EmailVerificationSender,
} from './email-verification-sender.port';
import { EmailVerifications } from './email-verifications';

@Injectable()
export class EmailVerificationDelivery {
  constructor(
    @Inject(EMAIL_VERIFICATION_SENDER)
    private readonly sender: EmailVerificationSender,
    private readonly verifications: EmailVerifications,
    private readonly clock: Clock,
  ) {}

  async attempt(input: {
    verificationId: string;
    email: string;
    token: string;
    expiresAt: Date;
  }): Promise<boolean> {
    let status: 'SENT' | 'FAILED' = 'SENT';
    try {
      await this.sender.send({
        to: input.email,
        token: input.token,
        expiresAt: input.expiresAt,
      });
    } catch {
      status = 'FAILED';
    }

    await this.verifications
      .markDelivery(input.verificationId, status, this.clock.now())
      .catch(() => undefined);
    return status === 'SENT';
  }
}
