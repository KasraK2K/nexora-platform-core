import { Inject, Injectable } from '@nestjs/common';
import { Clock } from '../../../shared/application/clock';
import {
  PASSWORD_RESET_SENDER,
  type PasswordResetSender,
} from './password-reset-sender.port';
import { PasswordResetTokens } from './password-reset-tokens';

@Injectable()
export class PasswordResetDelivery {
  constructor(
    @Inject(PASSWORD_RESET_SENDER)
    private readonly sender: PasswordResetSender,
    private readonly tokens: PasswordResetTokens,
    private readonly clock: Clock,
  ) {}

  async attempt(input: {
    resetId: string;
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

    await this.tokens
      .markDelivery(input.resetId, status, this.clock.now())
      .catch(() => undefined);
    return status === 'SENT';
  }
}
