import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import {
  PasswordCredentialsService,
  type VerifiedPasswordCredential,
} from '../../identity/password-credentials.service';
import { MembershipsService } from '../../memberships/memberships.service';
import { UsersService } from '../../users/users.service';
import { Clock } from '../../../common/clock';
import { IdentifierFactory } from '../../../common/identifier-factory';
import { readSafeErrorCode } from '../../../common/errors/safe-error-code';
import { TRANSACTION_MANAGER } from '../../../common/transaction-manager';
import type { TransactionManager } from '../../../common/transaction-manager';
import { isTransactionWriteConflict } from '../../../common/transaction-write-conflict';
import { PasswordPolicy } from '../security/password-policy';
import {
  AuthenticationRequiredError,
  InvalidPasswordChangePasswordError,
  PasswordChangeInvalidCurrentPasswordError,
  PasswordChangeUnavailableError,
} from '../errors/authentication.errors';
import { PASSWORD_COMPROMISE_CHECKER } from '../security/password-compromise-checker';
import type { PasswordCompromiseChecker } from '../security/password-compromise-checker';
import { PASSWORD_HASHER } from '../security/password-hasher';
import type { PasswordHasher } from '../security/password-hasher';
import { PasswordResetTokensRepository } from '../repositories/password-reset-tokens.repository';
import { OpaqueTokenService } from '../../../common/security/opaque-token.service';
import type {
  RevokedSession,
  SessionRecord,
} from '../repositories/authentication-sessions.repository';
import { SessionStoreService } from '../services/session-store.service';

/** Rotated current-session secret returned after a successful password change. */
export type ChangedPasswordSession = {
  sessionToken: string;
  sessionExpiresAt: Date;
};

type PasswordChangeContext = { session: SessionRecord; identityId: string };

/** Owns authenticated password replacement and session rotation. */
@Injectable()
export class PasswordChangeService {
  private readonly logger = new Logger('ChangePassword');

  constructor(
    private readonly users: UsersService,
    private readonly memberships: MembershipsService,
    private readonly sessions: SessionStoreService,
    private readonly resetTokens: PasswordResetTokensRepository,
    private readonly sessionTokens: OpaqueTokenService,
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
  ) {}

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
            await this.audit.append({
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
        this.logFailure('password_change.transaction_failed', error);
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

  /** Resolves the current durable session and active identity context. */
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
    this.logFailure('password_change.context_resolution_failed', failure);
    throw new PasswordChangeUnavailableError();
  }

  /** Loads session, user, and membership facts from authoritative storage. */
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

  /** Verifies the current password and returns a stale-write proof. */
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
      if (error instanceof PasswordChangeInvalidCurrentPasswordError) {
        throw error;
      }
      this.logFailure('password_change.credential_check_failed', error);
      throw new PasswordChangeUnavailableError();
    }
  }

  /** Rejects a compromised replacement password. */
  private async assertReplacementIsAllowed(password: string): Promise<void> {
    try {
      if (await this.compromiseChecker.isCompromised(password)) {
        throw new InvalidPasswordChangePasswordError(
          'Choose a password that has not appeared in common-password or breach data.',
        );
      }
    } catch (error) {
      if (error instanceof InvalidPasswordChangePasswordError) throw error;
      this.logFailure('password_change.compromise_check_failed', error);
      throw new PasswordChangeUnavailableError();
    }
  }

  /** Hashes a replacement password through the configured crypto boundary. */
  private async hashReplacement(password: string): Promise<string> {
    try {
      return await this.passwordHasher.hash(password);
    } catch (error) {
      this.logFailure('password_change.hash_failed', error);
      throw new PasswordChangeUnavailableError();
    }
  }

  /** Rechecks the exact session, user, identity, and membership in transaction. */
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

  /** Writes only a safe failure classification to structured logs. */
  private logFailure(event: string, error: unknown): void {
    this.logger.error(
      JSON.stringify({
        event,
        errorType: error instanceof Error ? error.name : 'UnknownError',
        errorCode: readSafeErrorCode(error),
      }),
    );
  }
}
