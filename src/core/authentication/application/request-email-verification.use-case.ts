import { Injectable, Logger } from '@nestjs/common';
import { AuditLog } from '../../audit/application/audit-log';
import { AppConfig } from '../../configuration/app-config';
import { IdentityLookup } from '../../identity/application/identity-lookup';
import { Users } from '../../users/application/users';
import { Clock } from '../../../shared/application/clock';
import { IdentifierFactory } from '../../../shared/application/identifier-factory';
import { TRANSACTION_MANAGER } from '../../../shared/application/transaction-manager.port';
import type { TransactionManager } from '../../../shared/application/transaction-manager.port';
import { EmailVerificationUnavailableError } from '../domain/registration.errors';
import { EmailVerificationDelivery } from './email-verification-delivery';
import { EmailVerificationTokenService } from './email-verification-token.service';
import { EmailVerifications } from './email-verifications';
import { Inject } from '@nestjs/common';

@Injectable()
export class RequestEmailVerification {
  private readonly logger = new Logger(RequestEmailVerification.name);

  constructor(
    private readonly identities: IdentityLookup,
    private readonly users: Users,
    private readonly verifications: EmailVerifications,
    private readonly delivery: EmailVerificationDelivery,
    private readonly tokens: EmailVerificationTokenService,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
    private readonly auditLog: AuditLog,
    private readonly config: AppConfig,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
  ) {}

  async execute(email: string): Promise<void> {
    const identity = await this.identities.findByEmail(email).catch(() => {
      throw new EmailVerificationUnavailableError();
    });
    if (!identity) {
      return;
    }

    const user = await this.users.findByIdentityId(identity.id).catch(() => {
      throw new EmailVerificationUnavailableError();
    });
    if (!user || user.status !== 'PENDING_VERIFICATION') {
      return;
    }

    const previous = await this.verifications
      .findLatestForUser(user.id)
      .catch(() => {
        throw new EmailVerificationUnavailableError();
      });
    if (!previous) {
      return;
    }

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
        if (!current || current.status !== 'PENDING_VERIFICATION') {
          return false;
        }
        await this.verifications.invalidateOpenForUser(user.id, now);
        await this.verifications.create({
          id: verificationId,
          userId: user.id,
          workspaceId: previous.workspaceId,
          tokenHash: token.hash,
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
      this.logger.error(
        JSON.stringify({
          event: 'email_verification.request_failed',
          errorType: error instanceof Error ? error.name : 'UnknownError',
        }),
      );
      throw new EmailVerificationUnavailableError();
    }

    if (created) {
      await this.delivery.attempt({
        verificationId,
        email: identity.normalizedEmail,
        token: token.raw,
        expiresAt,
      });
    }
  }
}
