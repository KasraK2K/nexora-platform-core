import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { PasswordCredentialsService } from '../../identity/password-credentials.service';
import {
  IdentityService,
  type IdentitySummary,
} from '../../identity/identity.service';
import { UsersService, type UserSummary } from '../../users/users.service';
import { AppConfig } from '../../../config/app-config';
import { Clock } from '../../../common/clock';
import { IdentifierFactory } from '../../../common/identifier-factory';
import { readSafeErrorCode } from '../../../common/errors/safe-error-code';
import { TRANSACTION_MANAGER } from '../../../common/transaction-manager';
import type { TransactionManager } from '../../../common/transaction-manager';
import { isTransactionWriteConflict } from '../../../common/transaction-write-conflict';
import { PasswordPolicy } from '../security/password-policy';
import {
  InvalidPasswordResetPasswordError,
  PasswordResetInvalidError,
  PasswordResetUnavailableError,
} from '../errors/authentication.errors';
import { PASSWORD_COMPROMISE_CHECKER } from '../security/password-compromise-checker';
import type { PasswordCompromiseChecker } from '../security/password-compromise-checker';
import { PASSWORD_HASHER } from '../security/password-hasher';
import type { PasswordHasher } from '../security/password-hasher';
import { PasswordResetDeliveryService } from '../mail/password-reset-delivery.service';
import { OpaqueTokenService } from '../../../common/security/opaque-token.service';
import {
  type PasswordResetTokenRecord,
  PasswordResetTokensRepository,
} from '../repositories/password-reset-tokens.repository';
import type { SessionContext } from '../repositories/authentication-sessions.repository';
import { SessionStoreService } from '../services/session-store.service';

/** Owns enumeration-resistant password reset request and confirmation flows. */
@Injectable()
export class PasswordResetService {
  private readonly requestLogger = new Logger('RequestPasswordReset');
  private readonly resetLogger = new Logger('ResetPassword');

  constructor(
    private readonly identities: IdentityService,
    private readonly users: UsersService,
    private readonly sessions: SessionStoreService,
    private readonly resetTokens: PasswordResetTokensRepository,
    private readonly delivery: PasswordResetDeliveryService,
    private readonly tokenService: OpaqueTokenService,
    private readonly credentials: PasswordCredentialsService,
    private readonly audit: AuditService,
    private readonly passwordPolicy: PasswordPolicy,
    @Inject(PASSWORD_COMPROMISE_CHECKER)
    private readonly compromiseChecker: PasswordCompromiseChecker,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
    private readonly config: AppConfig,
  ) {}

  /** Accepts an enumeration-resistant password reset request. */
  async requestReset(email: string): Promise<void> {
    let identity: IdentitySummary | null;
    try {
      identity = await this.identities.findByEmail(email);
    } catch {
      throw new PasswordResetUnavailableError();
    }
    if (!identity) return;

    let user: UserSummary | null;
    let sessionContext: SessionContext | null;
    try {
      user = await this.users.findByIdentityId(identity.id);
      sessionContext = user
        ? await this.sessions.findLatestForUser(user.id)
        : null;
    } catch {
      throw new PasswordResetUnavailableError();
    }
    if (!user || user.status !== 'ACTIVE' || !sessionContext) return;

    const token = this.tokenService.create();
    const resetId = this.identifiers.create();
    const now = this.clock.now();
    const expiresAt = new Date(
      now.getTime() + this.config.passwordResetTtlSeconds * 1000,
    );
    let created = false;
    try {
      created = await this.transactions.execute(async () => {
        const [current, currentSessionContext] = await Promise.all([
          this.users.findById(user.id),
          this.sessions.findLatestForUser(user.id),
        ]);
        if (!current || current.status !== 'ACTIVE' || !currentSessionContext) {
          return false;
        }
        await this.resetTokens.invalidateOpenForUser(user.id, now);
        await this.resetTokens.create({
          id: resetId,
          identityId: identity.id,
          userId: user.id,
          workspaceId: currentSessionContext.activeWorkspaceId,
          tokenHash: token.hash,
          expiresAt,
        });
        await this.delivery.enqueue({
          resetId,
          workspaceId: currentSessionContext.activeWorkspaceId,
          email: identity.normalizedEmail,
          token: token.raw,
          expiresAt,
        });
        return true;
      });
    } catch (error) {
      this.logFailure(
        this.requestLogger,
        'password_reset.request_failed',
        error,
      );
      throw new PasswordResetUnavailableError();
    }
    if (created) this.delivery.dispatch(resetId);
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
    let compromised: boolean;
    try {
      compromised = await this.compromiseChecker.isCompromised(password);
    } catch {
      throw new PasswordResetUnavailableError();
    }
    if (compromised) {
      throw new InvalidPasswordResetPasswordError(
        'Choose a password that has not appeared in common-password or breach data.',
      );
    }
    let passwordHash: string;
    try {
      passwordHash = await this.passwordHasher.hash(password);
    } catch {
      throw new PasswordResetUnavailableError();
    }

    let revokedTokenHashes: string[] = [];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        revokedTokenHashes = await this.transactions.execute(async () => {
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
            !(await this.credentials.replacePasswordHash(
              reset.identityId,
              passwordHash,
            ))
          ) {
            throw new Error('Password credential is missing.');
          }
          const revoked = await this.sessions.revokeAllForUser(
            reset.userId,
            transactionTime,
          );
          const workspaceIds = new Set([
            reset.workspaceId,
            ...revoked.map((session) => session.activeWorkspaceId),
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
          return revoked.map((session) => session.tokenHash);
        });
        break;
      } catch (error) {
        if (attempt === 0 && isTransactionWriteConflict(error)) continue;
        if (error instanceof PasswordResetInvalidError) throw error;
        this.logFailure(
          this.resetLogger,
          'password_reset.confirmation_failed',
          error,
        );
        throw new PasswordResetUnavailableError();
      }
    }
    await Promise.all(
      revokedTokenHashes.map((hash) =>
        this.sessions.removeCacheBestEffort(hash),
      ),
    );
  }

  /** Writes only a safe failure classification to structured logs. */
  private logFailure(logger: Logger, event: string, error: unknown): void {
    logger.error(
      JSON.stringify({
        event,
        errorType: error instanceof Error ? error.name : 'UnknownError',
        errorCode: readSafeErrorCode(error),
      }),
    );
  }
}
