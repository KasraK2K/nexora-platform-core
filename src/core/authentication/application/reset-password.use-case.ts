import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditLog } from '../../audit/application/audit-log';
import { PasswordCredentialManagement } from '../../identity/application/password-credential-management';
import { Users } from '../../users/application/users';
import { Clock } from '../../../shared/application/clock';
import { IdentifierFactory } from '../../../shared/application/identifier-factory';
import { TRANSACTION_MANAGER } from '../../../shared/application/transaction-manager.port';
import type { TransactionManager } from '../../../shared/application/transaction-manager.port';
import { isTransactionWriteConflict } from '../../../shared/application/transaction-write-conflict';
import { PasswordPolicy } from '../domain/password-policy';
import {
  InvalidPasswordResetPasswordError,
  PasswordResetInvalidError,
  PasswordResetUnavailableError,
} from '../domain/registration.errors';
import { AuthenticationSessions } from './authentication-sessions';
import { PASSWORD_COMPROMISE_CHECKER } from './password-compromise-checker.port';
import type { PasswordCompromiseChecker } from './password-compromise-checker.port';
import { PASSWORD_HASHER } from './password-hasher.port';
import type { PasswordHasher } from './password-hasher.port';
import { PasswordResetTokenService } from './password-reset-token.service';
import {
  PasswordResetTokens,
  type PasswordResetTokenRecord,
} from './password-reset-tokens';
import { SESSION_CACHE } from './session-cache.port';
import type { SessionCachePort } from './session-cache.port';

@Injectable()
export class ResetPassword {
  private readonly logger = new Logger(ResetPassword.name);

  constructor(
    private readonly resetTokens: PasswordResetTokens,
    private readonly credentials: PasswordCredentialManagement,
    private readonly users: Users,
    private readonly sessions: AuthenticationSessions,
    private readonly auditLog: AuditLog,
    private readonly tokens: PasswordResetTokenService,
    private readonly passwordPolicy: PasswordPolicy,
    @Inject(PASSWORD_COMPROMISE_CHECKER)
    private readonly compromiseChecker: PasswordCompromiseChecker,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
    @Inject(SESSION_CACHE) private readonly sessionCache: SessionCachePort,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
  ) {}

  async execute(input: { token: string; newPassword: string }): Promise<void> {
    const tokenHash = this.tokens.hashIfValid(input.token);
    if (!tokenHash) {
      throw new PasswordResetInvalidError();
    }

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
    if (!initialReset) {
      throw new PasswordResetInvalidError();
    }

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
          const user = await this.users.findById(reset.userId);
          if (!user || user.status !== 'ACTIVE') {
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
            await this.auditLog.append({
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
        if (attempt === 0 && isWriteConflict(error)) {
          continue;
        }
        if (error instanceof PasswordResetInvalidError) {
          throw error;
        }
        this.logger.error(
          JSON.stringify({
            event: 'password_reset.confirmation_failed',
            errorType: error instanceof Error ? error.name : 'UnknownError',
          }),
        );
        throw new PasswordResetUnavailableError();
      }
    }

    await Promise.all(
      revokedTokenHashes.map((hash) =>
        this.sessionCache.remove(hash).catch(() => undefined),
      ),
    );
  }
}

function isWriteConflict(error: unknown): boolean {
  return isTransactionWriteConflict(error);
}
