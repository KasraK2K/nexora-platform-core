import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import {
  PasswordCredentialsService,
  type VerifiedPasswordCredential,
} from '../../identity/password-credentials.service';
import {
  IdentityService,
  type IdentitySummary,
} from '../../identity/identity.service';
import { MembershipsService } from '../../memberships/memberships.service';
import { UsersService, type UserSummary } from '../../users/users.service';
import { AppConfig } from '../../../config/app-config';
import { Clock } from '../../../common/application/clock';
import { IdentifierFactory } from '../../../common/application/identifier-factory';
import { TRANSACTION_MANAGER } from '../../../common/application/transaction-manager.port';
import type { TransactionManager } from '../../../common/application/transaction-manager.port';
import { isTransactionWriteConflict } from '../../../common/application/transaction-write-conflict';
import { PasswordPolicy } from '../domain/password-policy';
import {
  AuthenticationRequiredError,
  InvalidPasswordChangePasswordError,
  InvalidPasswordResetPasswordError,
  PasswordChangeInvalidCurrentPasswordError,
  PasswordChangeUnavailableError,
  PasswordResetInvalidError,
  PasswordResetUnavailableError,
} from '../domain/registration.errors';
import { PASSWORD_COMPROMISE_CHECKER } from '../application/password-compromise-checker.port';
import type { PasswordCompromiseChecker } from '../application/password-compromise-checker.port';
import { PASSWORD_HASHER } from '../application/password-hasher.port';
import type { PasswordHasher } from '../application/password-hasher.port';
import { PasswordResetDelivery } from '../application/password-reset-delivery';
import { PasswordResetTokenService } from '../application/password-reset-token.service';
import { SessionTokenService } from '../application/session-token.service';
import {
  PASSWORD_RESET_TOKENS_REPOSITORY,
  type PasswordResetTokenRecord,
  type PasswordResetTokensRepository,
} from '../repositories/password-reset-tokens.repository';
import type {
  RevokedSession,
  SessionContext,
  SessionRecord,
} from '../repositories/authentication-sessions.repository';
import { SessionStoreService } from '../application/session-store.service';

/** Rotated current-session secret returned after a successful password change. */
export type ChangedPasswordSession = {
  sessionToken: string;
  sessionExpiresAt: Date;
};

type PasswordChangeContext = { session: SessionRecord; identityId: string };

/** Owns password reset and authenticated password-change workflows. */
@Injectable()
export class PasswordService {
  private readonly requestResetLogger = new Logger('RequestPasswordReset');
  private readonly resetLogger = new Logger('ResetPassword');
  private readonly changeLogger = new Logger('ChangePassword');

  constructor(
    @Inject(IdentityService)
    private readonly identities: Pick<IdentityService, 'findByEmail'>,
    @Inject(UsersService)
    private readonly users: Pick<
      UsersService,
      'findById' | 'findByIdentityId' | 'findAuthenticationReferenceById'
    >,
    private readonly sessions: SessionStoreService,
    @Inject(PASSWORD_RESET_TOKENS_REPOSITORY)
    private readonly resetTokens: PasswordResetTokensRepository,
    private readonly delivery: PasswordResetDelivery,
    private readonly resetTokenService: PasswordResetTokenService,
    private readonly sessionTokens: SessionTokenService,
    @Inject(PasswordCredentialsService)
    private readonly credentials: Pick<
      PasswordCredentialsService,
      'verify' | 'replacePasswordHash' | 'replacePasswordHashIfVerified'
    >,
    @Inject(MembershipsService)
    private readonly memberships: Pick<MembershipsService, 'find'>,
    private readonly auditLog: AuditService,
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

    const token = this.resetTokenService.create();
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
        this.requestResetLogger,
        'password_reset.request_failed',
        error,
      );
      throw new PasswordResetUnavailableError();
    }
    if (created) this.delivery.dispatch(resetId);
  }

  /** Replaces a password from a valid single-use reset token. */
  async reset(input: { token: string; newPassword: string }): Promise<void> {
    const tokenHash = this.resetTokenService.hashIfValid(input.token);
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
          const user = await this.users.findById(reset.userId);
          if (!user || user.status !== 'ACTIVE')
            throw new PasswordResetInvalidError();
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

  /** Changes an authenticated user's password and rotates session authority. */
  async change(input: {
    rawSessionToken: string | undefined;
    currentPassword: string;
    newPassword: string;
  }): Promise<ChangedPasswordSession> {
    const tokenHash = this.sessionTokens.hashIfValid(input.rawSessionToken);
    if (!tokenHash) throw new AuthenticationRequiredError();

    const context = await this.resolveContext(tokenHash);
    const currentPassword = input.currentPassword.normalize('NFC');
    const verifiedCredential = await this.verifyCurrentPassword(
      context.identityId,
      currentPassword,
    );
    const newPassword = this.passwordPolicy.validateChangedPassword(
      input.newPassword,
    );
    if (newPassword === currentPassword) {
      throw new InvalidPasswordChangePasswordError(
        'The new password must differ from the current password.',
      );
    }
    await this.assertReplacementIsAllowed(newPassword);
    const passwordHash = await this.hashReplacement(newPassword);
    const replacement = this.sessionTokens.create();
    const replacementSessionId = this.identifiers.create();

    let result:
      { revokedSessions: RevokedSession[]; sessionExpiresAt: Date } | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        result = await this.transactions.execute(async () => {
          const now = this.clock.now();
          const current = await this.sessions.findByTokenHash(tokenHash);
          const currentSession = await this.requireCurrentContext(
            current,
            context,
            now,
          );
          const replaced = await this.credentials.replacePasswordHashIfVerified(
            verifiedCredential,
            passwordHash,
          );
          if (!replaced) throw new PasswordChangeInvalidCurrentPasswordError();
          await this.resetTokens.invalidateOpenForUser(
            context.session.userId,
            now,
          );
          const revokedSessions = await this.sessions.revokeAllForUser(
            context.session.userId,
            now,
          );
          const sessionExpiresAt = currentSession.expiresAt;
          await this.sessions.create({
            id: replacementSessionId,
            tokenHash: replacement.hash,
            userId: context.session.userId,
            activeWorkspaceId: context.session.activeWorkspaceId,
            expiresAt: sessionExpiresAt,
          });
          const workspaceIds = new Set([
            context.session.activeWorkspaceId,
            ...revokedSessions.map((session) => session.activeWorkspaceId),
          ]);
          for (const workspaceId of workspaceIds) {
            await this.auditLog.append({
              id: this.identifiers.create(),
              workspaceId,
              actorUserId: context.session.userId,
              action: 'password.change.completed',
              resourceId: context.session.userId,
            });
          }
          return { revokedSessions, sessionExpiresAt };
        });
        break;
      } catch (error) {
        if (attempt === 0 && isTransactionWriteConflict(error)) continue;
        if (
          error instanceof AuthenticationRequiredError ||
          error instanceof PasswordChangeInvalidCurrentPasswordError
        ) {
          throw error;
        }
        this.logFailure(
          this.changeLogger,
          'password_change.transaction_failed',
          error,
        );
        throw new PasswordChangeUnavailableError();
      }
    }
    if (!result) throw new PasswordChangeUnavailableError();
    await Promise.all(
      result.revokedSessions.map((session) =>
        this.sessions.removeCacheBestEffort(session.tokenHash),
      ),
    );
    await this.sessions.storeCacheBestEffort(
      replacement.hash,
      {
        userId: context.session.userId,
        workspaceId: context.session.activeWorkspaceId,
      },
      result.sessionExpiresAt,
    );
    return {
      sessionToken: replacement.raw,
      sessionExpiresAt: result.sessionExpiresAt,
    };
  }

  private async resolveContext(
    tokenHash: string,
  ): Promise<PasswordChangeContext> {
    let failure: unknown;
    try {
      return await this.loadPasswordChangeContext(tokenHash);
    } catch (error) {
      failure = error;
    }
    if (failure instanceof AuthenticationRequiredError) throw failure;
    this.logFailure(
      this.changeLogger,
      'password_change.context_resolution_failed',
      failure,
    );
    throw new PasswordChangeUnavailableError();
  }

  private async loadPasswordChangeContext(
    tokenHash: string,
  ): Promise<PasswordChangeContext> {
    const now = this.clock.now();
    const session = await this.sessions.findByTokenHash(tokenHash);
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= now.getTime()
    ) {
      throw new AuthenticationRequiredError();
    }
    const [user, membership] = await Promise.all([
      this.users.findAuthenticationReferenceById(session.userId),
      this.memberships.find({
        userId: session.userId,
        workspaceId: session.activeWorkspaceId,
      }),
    ]);
    if (!user || user.status !== 'ACTIVE' || !membership) {
      throw new AuthenticationRequiredError();
    }
    return { session, identityId: user.identityId };
  }

  private async verifyCurrentPassword(
    identityId: string,
    currentPassword: string,
  ): Promise<VerifiedPasswordCredential> {
    try {
      const verified = await this.credentials.verify({
        identityId,
        password: currentPassword,
      });
      if (!verified) throw new PasswordChangeInvalidCurrentPasswordError();
      return verified;
    } catch (error) {
      if (error instanceof PasswordChangeInvalidCurrentPasswordError)
        throw error;
      this.logFailure(
        this.changeLogger,
        'password_change.credential_check_failed',
        error,
      );
      throw new PasswordChangeUnavailableError();
    }
  }

  private async assertReplacementIsAllowed(password: string): Promise<void> {
    try {
      if (await this.compromiseChecker.isCompromised(password)) {
        throw new InvalidPasswordChangePasswordError(
          'Choose a password that has not appeared in common-password or breach data.',
        );
      }
    } catch (error) {
      if (error instanceof InvalidPasswordChangePasswordError) throw error;
      this.logFailure(
        this.changeLogger,
        'password_change.compromise_check_failed',
        error,
      );
      throw new PasswordChangeUnavailableError();
    }
  }

  private async hashReplacement(password: string): Promise<string> {
    try {
      return await this.passwordHasher.hash(password);
    } catch (error) {
      this.logFailure(this.changeLogger, 'password_change.hash_failed', error);
      throw new PasswordChangeUnavailableError();
    }
  }

  private async requireCurrentContext(
    current: SessionRecord | null,
    expected: PasswordChangeContext,
    now: Date,
  ): Promise<SessionRecord> {
    if (
      !current ||
      current.id !== expected.session.id ||
      current.userId !== expected.session.userId ||
      current.activeWorkspaceId !== expected.session.activeWorkspaceId ||
      current.revokedAt ||
      current.expiresAt.getTime() <= now.getTime()
    ) {
      throw new AuthenticationRequiredError();
    }
    const [user, membership] = await Promise.all([
      this.users.findAuthenticationReferenceById(current.userId),
      this.memberships.find({
        userId: current.userId,
        workspaceId: current.activeWorkspaceId,
      }),
    ]);
    if (
      !user ||
      user.identityId !== expected.identityId ||
      user.status !== 'ACTIVE' ||
      !membership
    ) {
      throw new AuthenticationRequiredError();
    }
    return current;
  }

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

/** Extracts only a string error code that is safe for structured logs. */
function readSafeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error))
    return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}
