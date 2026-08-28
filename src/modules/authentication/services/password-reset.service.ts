import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { UsersService } from '../../users/users.service';
import { AppConfig } from '../../../config/app-config';
import { Clock } from '../../../common/clock';
import { IdentifierFactory } from '../../../common/identifier-factory';
import { logSafeFailure } from '../../../common/logging/log-safe-failure';
import { retryOnceOnWriteConflict } from '../../../common/transaction-retry';
import { TRANSACTION_MANAGER } from '../../../common/transaction-manager';
import type { TransactionManager } from '../../../common/transaction-manager';
import { PasswordPolicy } from '../security/password-policy';
import {
  PasswordResetInvalidError,
  PasswordResetUnavailableError,
} from '../errors/authentication.errors';
import { PasswordResetDeliveryService } from '../mail/password-reset-delivery.service';
import { OpaqueTokenService } from '../../../common/security/opaque-token.service';
import {
  type PasswordResetTokenRecord,
  PasswordResetTokensRepository,
} from '../repositories/password-reset-tokens.repository';
import { SessionsService } from '../../sessions/sessions.service';

/** Owns enumeration-resistant password reset request and confirmation flows. */
@Injectable()
export class PasswordResetService {
  private readonly requestLogger = new Logger('RequestPasswordReset');
  private readonly resetLogger = new Logger('ResetPassword');

  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly resetTokens: PasswordResetTokensRepository,
    private readonly delivery: PasswordResetDeliveryService,
    private readonly tokenService: OpaqueTokenService,
    private readonly audit: AuditService,
    private readonly passwordPolicy: PasswordPolicy,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
    private readonly config: AppConfig,
  ) {}

  /** Accepts an enumeration-resistant password reset request. */
  async requestReset(email: string): Promise<void> {
    let user;
    try {
      user = await this.users.findByEmail(email);
    } catch {
      throw new PasswordResetUnavailableError();
    }
    if (!user || user.status !== 'ACTIVE') return;

    const token = this.tokenService.create();
    const resetId = this.identifiers.create();
    const now = this.clock.now();
    const expiresAt = new Date(
      now.getTime() + this.config.passwordResetTtlSeconds * 1000,
    );
    try {
      await this.transactions.execute(async () => {
        const [current, currentSessionContext] = await Promise.all([
          this.users.findById(user.id),
          this.sessions.findLatestForUser(user.id),
        ]);
        if (!current || current.status !== 'ACTIVE' || !currentSessionContext) {
          return;
        }
        await this.resetTokens.invalidateOpenForUser(user.id, now);
        await this.resetTokens.create({
          id: resetId,
          userId: user.id,
          workspaceId: currentSessionContext.workspaceId,
          tokenHash: token.hash,
          expiresAt,
        });
        await this.delivery.enqueue({
          resetId,
          workspaceId: currentSessionContext.workspaceId,
          email: user.normalizedEmail,
          token: token.raw,
          expiresAt,
        });
      });
    } catch (error) {
      logSafeFailure(
        this.requestLogger,
        'password_reset.request_failed',
        error,
      );
      throw new PasswordResetUnavailableError();
    }
  }

  /** Replaces a password from a valid single-use reset token. */
  async reset(input: { token: string; newPassword: string }): Promise<void> {
    const tokenHash = this.tokenService.hashIfValid(input.token);
    if (!tokenHash) throw new PasswordResetInvalidError();

    const now = this.clock.now();
    let initialReset: PasswordResetTokenRecord | null;
    try {
      initialReset = await this.resetTokens.findUsableByTokenHash(
        tokenHash,
        now,
      );
    } catch {
      throw new PasswordResetUnavailableError();
    }
    if (!initialReset) throw new PasswordResetInvalidError();

    const password = this.passwordPolicy.validateResetPassword(
      input.newPassword,
    );
    let passwordHash: string;
    try {
      passwordHash = await this.users.hashPassword(password);
    } catch {
      throw new PasswordResetUnavailableError();
    }

    try {
      await retryOnceOnWriteConflict(() =>
        this.transactions.execute(async () => {
          const transactionTime = this.clock.now();
          const reset = await this.resetTokens.findUsableByTokenHash(
            tokenHash,
            transactionTime,
          );
          if (!reset || reset.id !== initialReset.id) {
            throw new PasswordResetInvalidError();
          }
          const currentUser = await this.users.findById(reset.userId);
          if (!currentUser || currentUser.status !== 'ACTIVE') {
            throw new PasswordResetInvalidError();
          }
          if (!(await this.resetTokens.consume(reset.id, transactionTime))) {
            throw new PasswordResetInvalidError();
          }
          await this.resetTokens.invalidateOpenForUser(
            reset.userId,
            transactionTime,
          );
          if (
            !(await this.users.replacePasswordHash(reset.userId, passwordHash))
          ) {
            throw new Error('Password credential is missing.');
          }
          const revoked = await this.sessions.revokeAllForUser(
            reset.userId,
            transactionTime,
          );
          const workspaceIds = new Set([
            reset.workspaceId,
            ...revoked.map((session) => session.workspaceId),
          ]);
          for (const workspaceId of workspaceIds) {
            await this.audit.append({
              id: this.identifiers.create(),
              workspaceId,
              actorUserId: reset.userId,
              action: 'password.reset.completed',
              resourceId: reset.userId,
            });
          }
        }),
      );
    } catch (error) {
      if (error instanceof PasswordResetInvalidError) throw error;
      logSafeFailure(
        this.resetLogger,
        'password_reset.confirmation_failed',
        error,
      );
      throw new PasswordResetUnavailableError();
    }
  }
}
