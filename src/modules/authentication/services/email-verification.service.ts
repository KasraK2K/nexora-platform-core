import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { UsersService } from '../../users/users.service';
import { AppConfig } from '../../../config/app-config';
import { Clock } from '../../../common/clock';
import { IdentifierFactory } from '../../../common/identifier-factory';
import { TRANSACTION_MANAGER } from '../../../common/transaction-manager';
import type { TransactionManager } from '../../../common/transaction-manager';
import {
  EmailVerificationInvalidError,
  EmailVerificationUnavailableError,
} from '../errors/authentication.errors';
import { EmailVerificationDeliveryService } from '../mail/email-verification-delivery.service';
import { OpaqueTokenService } from '../../../common/security/opaque-token.service';
import { EmailVerificationsRepository } from '../repositories/email-verifications.repository';

/** Owns email-verification request and confirmation transactions. */
@Injectable()
export class EmailVerificationService {
  private readonly requestLogger = new Logger('RequestEmailVerification');
  private readonly confirmationLogger = new Logger('VerifyEmail');

  constructor(
    private readonly users: UsersService,
    private readonly verifications: EmailVerificationsRepository,
    private readonly delivery: EmailVerificationDeliveryService,
    private readonly tokens: OpaqueTokenService,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
    private readonly auditLog: AuditService,
    private readonly config: AppConfig,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
  ) {}

  /** Accepts an enumeration-resistant replacement verification request. */
  async request(email: string): Promise<void> {
    const user = await this.users.findByEmail(email).catch(() => {
      throw new EmailVerificationUnavailableError();
    });
    if (!user || user.status !== 'PENDING_VERIFICATION') return;
    const previous = await this.verifications
      .findLatestForUser(user.id)
      .catch(() => {
        throw new EmailVerificationUnavailableError();
      });
    if (!previous) return;

    const token = this.tokens.create();
    const verificationId = this.identifiers.create();
    const now = this.clock.now();
    const expiresAt = new Date(
      now.getTime() + this.config.emailVerificationTtlSeconds * 1000,
    );
    try {
      await this.transactions.execute(async () => {
        const current = await this.users.findById(user.id);
        if (!current || current.status !== 'PENDING_VERIFICATION') return;
        await this.verifications.invalidateOpenForUser(user.id, now);
        await this.verifications.create({
          id: verificationId,
          userId: user.id,
          workspaceId: previous.workspaceId,
          tokenHash: token.hash,
          expiresAt,
        });
        await this.delivery.enqueue({
          verificationId,
          workspaceId: previous.workspaceId,
          email: user.normalizedEmail,
          token: token.raw,
          expiresAt,
        });
        await this.auditLog.append({
          id: this.identifiers.create(),
          workspaceId: previous.workspaceId,
          actorUserId: user.id,
          action: 'email.verification.requested',
          resourceId: verificationId,
        });
      });
    } catch (error) {
      this.logFailure(
        this.requestLogger,
        'email_verification.request_failed',
        error,
      );
      throw new EmailVerificationUnavailableError();
    }
  }

  /** Confirms one valid single-use email verification token. */
  async confirm(rawToken: string): Promise<void> {
    const tokenHash = this.tokens.hashIfValid(rawToken);
    if (!tokenHash) throw new EmailVerificationInvalidError();
    try {
      await this.transactions.execute(async () => {
        const now = this.clock.now();
        const verification = await this.verifications.findUsableByTokenHash(
          tokenHash,
          now,
        );
        if (!verification) throw new EmailVerificationInvalidError();
        const consumed = await this.verifications.consume(verification.id, now);
        const activated = consumed
          ? await this.users.activate(verification.userId)
          : false;
        if (!consumed || !activated) throw new EmailVerificationInvalidError();
        await this.auditLog.append({
          id: this.identifiers.create(),
          workspaceId: verification.workspaceId,
          actorUserId: verification.userId,
          action: 'email.verified',
          resourceId: verification.userId,
        });
      });
    } catch (error) {
      if (error instanceof EmailVerificationInvalidError) throw error;
      this.logFailure(
        this.confirmationLogger,
        'email_verification.confirmation_failed',
        error,
      );
      throw new EmailVerificationUnavailableError();
    }
  }

  private logFailure(logger: Logger, event: string, error: unknown): void {
    logger.error(
      JSON.stringify({
        event,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      }),
    );
  }
}
