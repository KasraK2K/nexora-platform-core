import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditLog } from '../../audit/application/audit-log';
import {
  PasswordCredentialVerification,
  type VerifiedPasswordCredential,
} from '../../identity/application/password-credential-verification';
import { Memberships } from '../../memberships/application/memberships';
import { Users } from '../../users/application/users';
import { Clock } from '../../../shared/application/clock';
import { IdentifierFactory } from '../../../shared/application/identifier-factory';
import { TRANSACTION_MANAGER } from '../../../shared/application/transaction-manager.port';
import type { TransactionManager } from '../../../shared/application/transaction-manager.port';
import { isTransactionWriteConflict } from '../../../shared/application/transaction-write-conflict';
import { PasswordPolicy } from '../domain/password-policy';
import {
  AuthenticationRequiredError,
  InvalidPasswordChangePasswordError,
  PasswordChangeInvalidCurrentPasswordError,
  PasswordChangeUnavailableError,
} from '../domain/registration.errors';
import {
  AuthenticationSessions,
  type RevokedSession,
  type SessionRecord,
} from './authentication-sessions';
import { PASSWORD_COMPROMISE_CHECKER } from './password-compromise-checker.port';
import type { PasswordCompromiseChecker } from './password-compromise-checker.port';
import { PASSWORD_HASHER } from './password-hasher.port';
import type { PasswordHasher } from './password-hasher.port';
import { PasswordResetTokens } from './password-reset-tokens';
import { SESSION_CACHE } from './session-cache.port';
import type { SessionCachePort } from './session-cache.port';
import { SessionTokenService } from './session-token.service';

export type ChangedPasswordSession = {
  sessionToken: string;
  sessionExpiresAt: Date;
};

type PasswordChangeContext = {
  session: SessionRecord;
  identityId: string;
};

@Injectable()
export class ChangePassword {
  private readonly logger = new Logger(ChangePassword.name);

  constructor(
    private readonly sessions: AuthenticationSessions,
    private readonly users: Users,
    private readonly memberships: Memberships,
    private readonly credentialVerification: PasswordCredentialVerification,
    private readonly resetTokens: PasswordResetTokens,
    private readonly auditLog: AuditLog,
    private readonly passwordPolicy: PasswordPolicy,
    @Inject(PASSWORD_COMPROMISE_CHECKER)
    private readonly compromiseChecker: PasswordCompromiseChecker,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
    @Inject(SESSION_CACHE) private readonly sessionCache: SessionCachePort,
    private readonly sessionTokens: SessionTokenService,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    rawSessionToken: string | undefined;
    currentPassword: string;
    newPassword: string;
  }): Promise<ChangedPasswordSession> {
    const tokenHash = this.sessionTokens.hashIfValid(input.rawSessionToken);
    if (!tokenHash) {
      throw new AuthenticationRequiredError();
    }

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

          const replaced =
            await this.credentialVerification.replacePasswordHashIfVerified(
              verifiedCredential,
              passwordHash,
            );
          if (!replaced) {
            throw new PasswordChangeInvalidCurrentPasswordError();
          }

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
        if (attempt === 0 && isWriteConflict(error)) {
          continue;
        }
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

    if (!result) {
      throw new PasswordChangeUnavailableError();
    }

    await Promise.all(
      result.revokedSessions.map((session) =>
        this.sessionCache.remove(session.tokenHash).catch(() => undefined),
      ),
    );
    await this.sessionCache
      .store(
        replacement.hash,
        {
          userId: context.session.userId,
          workspaceId: context.session.activeWorkspaceId,
        },
        result.sessionExpiresAt,
      )
      .catch(() => undefined);

    return {
      sessionToken: replacement.raw,
      sessionExpiresAt: result.sessionExpiresAt,
    };
  }

  private async resolveContext(
    tokenHash: string,
  ): Promise<PasswordChangeContext> {
    try {
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
    } catch (error) {
      if (error instanceof AuthenticationRequiredError) {
        throw error;
      }
      this.logFailure('password_change.context_resolution_failed', error);
      throw new PasswordChangeUnavailableError();
    }
  }

  private async verifyCurrentPassword(
    identityId: string,
    currentPassword: string,
  ): Promise<VerifiedPasswordCredential> {
    try {
      const verified = await this.credentialVerification.verify({
        identityId,
        password: currentPassword,
      });
      if (!verified) {
        throw new PasswordChangeInvalidCurrentPasswordError();
      }
      return verified;
    } catch (error) {
      if (error instanceof PasswordChangeInvalidCurrentPasswordError) {
        throw error;
      }
      this.logFailure('password_change.credential_check_failed', error);
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
      if (error instanceof InvalidPasswordChangePasswordError) {
        throw error;
      }
      this.logFailure('password_change.compromise_check_failed', error);
      throw new PasswordChangeUnavailableError();
    }
  }

  private async hashReplacement(password: string): Promise<string> {
    try {
      return await this.passwordHasher.hash(password);
    } catch (error) {
      this.logFailure('password_change.hash_failed', error);
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

function isWriteConflict(error: unknown): boolean {
  return isTransactionWriteConflict(error);
}

function readSafeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  return typeof error.code === 'string' ? error.code : undefined;
}
