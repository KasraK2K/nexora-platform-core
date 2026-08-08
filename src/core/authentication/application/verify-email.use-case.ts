import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditLog } from '../../audit/application/audit-log';
import { Users } from '../../users/application/users';
import { Clock } from '../../../shared/application/clock';
import { IdentifierFactory } from '../../../shared/application/identifier-factory';
import { TRANSACTION_MANAGER } from '../../../shared/application/transaction-manager.port';
import type { TransactionManager } from '../../../shared/application/transaction-manager.port';
import {
  EmailVerificationInvalidError,
  EmailVerificationUnavailableError,
} from '../domain/registration.errors';
import { EmailVerificationTokenService } from './email-verification-token.service';
import { EmailVerifications } from './email-verifications';

@Injectable()
export class VerifyEmail {
  private readonly logger = new Logger(VerifyEmail.name);

  constructor(
    private readonly verifications: EmailVerifications,
    private readonly users: Users,
    private readonly auditLog: AuditLog,
    private readonly tokens: EmailVerificationTokenService,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
  ) {}

  async execute(rawToken: string): Promise<void> {
    const tokenHash = this.tokens.hashIfValid(rawToken);
    if (!tokenHash) {
      throw new EmailVerificationInvalidError();
    }

    try {
      await this.transactions.execute(async () => {
        const now = this.clock.now();
        const verification = await this.verifications.findUsableByTokenHash(
          tokenHash,
          now,
        );
        if (!verification) {
          throw new EmailVerificationInvalidError();
        }

        const consumed = await this.verifications.consume(verification.id, now);
        const activated = consumed
          ? await this.users.activate(verification.userId)
          : false;
        if (!consumed || !activated) {
          throw new EmailVerificationInvalidError();
        }

        await this.auditLog.append({
          id: this.identifiers.create(),
          workspaceId: verification.workspaceId,
          actorUserId: verification.userId,
          action: 'email.verified',
          resourceId: verification.userId,
        });
      });
    } catch (error) {
      if (error instanceof EmailVerificationInvalidError) {
        throw error;
      }
      this.logger.error(
        JSON.stringify({
          event: 'email_verification.confirmation_failed',
          errorType: error instanceof Error ? error.name : 'UnknownError',
        }),
      );
      throw new EmailVerificationUnavailableError();
    }
  }
}
