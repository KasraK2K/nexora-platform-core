import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { IdentityService } from '../../identity/identity.service';
import { UsersService } from '../../users/users.service';
import { AppConfig } from '../../../config/app-config';
import { Clock } from '../../../common/application/clock';
import { IdentifierFactory } from '../../../common/application/identifier-factory';
import { TRANSACTION_MANAGER } from '../../../common/application/transaction-manager.port';
import type { TransactionManager } from '../../../common/application/transaction-manager.port';
import {
  EmailVerificationInvalidError,
  EmailVerificationUnavailableError,
} from '../domain/registration.errors';
import { EmailVerificationDelivery } from '../application/email-verification-delivery';
import { EmailVerificationTokenService } from '../application/email-verification-token.service';
import {
  EMAIL_VERIFICATIONS_REPOSITORY,
  type EmailVerificationsRepository,
} from '../repositories/email-verifications.repository';

/** Owns email-verification request and confirmation transactions. */
@Injectable()
export class EmailVerificationService {
  private readonly requestLogger = new Logger('RequestEmailVerification');
  private readonly confirmationLogger = new Logger('VerifyEmail');

  constructor(
    @Inject(IdentityService)
    private readonly identities: Pick<IdentityService, 'findByEmail'>,
    @Inject(UsersService)
    private readonly users: Pick<
      UsersService,
      'findById' | 'findByIdentityId' | 'activate'
    >,
    @Inject(EMAIL_VERIFICATIONS_REPOSITORY)
    private readonly verifications: EmailVerificationsRepository,
    private readonly delivery: EmailVerificationDelivery,
    private readonly tokens: EmailVerificationTokenService,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
    private readonly auditLog: AuditService,
    private readonly config: AppConfig,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
  ) {}

  /** Accepts an enumeration-resistant replacement verification request. */
  async request(email: string): Promise<void> {
    const identity = await this.identities.findByEmail(email).catch(() => {
      throw new EmailVerificationUnavailableError();
    });
    if (!identity) return;
    const user = await this.users.findByIdentityId(identity.id).catch(() => {
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
    let created = false;
    try {
      created = await this.transactions.execute(async () => {
        const current = await this.users.findById(user.id);
        if (!current || current.status !== 'PENDING_VERIFICATION') return false;
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
          email: identity.normalizedEmail,
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
        return true;
      });
    } catch (error) {
      this.logFailure(
        this.requestLogger,
        'email_verification.request_failed',
        error,
      );
      throw new EmailVerificationUnavailableError();
    }
    if (created) this.delivery.dispatch(verificationId);
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
