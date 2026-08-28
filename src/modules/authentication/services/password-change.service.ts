import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { MembershipsService } from '../../memberships/memberships.service';
import { UsersService } from '../../users/users.service';
import { Clock } from '../../../common/clock';
import { IdentifierFactory } from '../../../common/identifier-factory';
import { logSafeFailure } from '../../../common/logging/log-safe-failure';
import { retryOnceOnWriteConflict } from '../../../common/transaction-retry';
import { TRANSACTION_MANAGER } from '../../../common/transaction-manager';
import type { TransactionManager } from '../../../common/transaction-manager';
import { PasswordPolicy } from '../security/password-policy';
import {
  AuthenticationRequiredError,
  InvalidPasswordChangePasswordError,
  PasswordChangeInvalidCurrentPasswordError,
  PasswordChangeUnavailableError,
} from '../errors/authentication.errors';
import { PasswordResetTokensRepository } from '../repositories/password-reset-tokens.repository';
import { OpaqueTokenService } from '../../../common/security/opaque-token.service';
import {
  SessionsService,
  type SessionRecord,
} from '../../sessions/sessions.service';
import type { VerifiedUserPassword } from '../../users/users.service';

/** Rotated current-session secret returned after a successful password change. */
export type ChangedPasswordSession = {
  sessionToken: string;
  sessionExpiresAt: Date;
};

type PasswordChangeContext = { session: SessionRecord };

/** Owns authenticated password replacement and session rotation. */
@Injectable()
export class PasswordChangeService {
  private readonly logger = new Logger('ChangePassword');

  constructor(
    private readonly users: UsersService,
    private readonly memberships: MembershipsService,
    private readonly sessions: SessionsService,
    private readonly resetTokens: PasswordResetTokensRepository,
    private readonly sessionTokens: OpaqueTokenService,
    private readonly audit: AuditService,
    private readonly passwordPolicy: PasswordPolicy,
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
      context.session.userId,
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
    const passwordHash = await this.hashReplacement(newPassword);
    const replacement = this.sessionTokens.create();
    const replacementSessionId = this.identifiers.create();

    let sessionExpiresAt: Date | undefined;
    try {
      sessionExpiresAt = await retryOnceOnWriteConflict(() =>
        this.transactions.execute(async () => {
          const now = this.clock.now();
          const current = await this.sessions.findByTokenHash(tokenHash);
          const currentSession = await this.requireCurrentContext(
            current,
            context,
            now,
          );
          const replaced = await this.users.replacePasswordHashIfVerified(
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
            workspaceId: context.session.workspaceId,
            expiresAt: sessionExpiresAt,
          });
          const workspaceIds = new Set([
            context.session.workspaceId,
            ...revokedSessions.map((session) => session.workspaceId),
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
          return sessionExpiresAt;
        }),
      );
    } catch (error) {
      if (
        error instanceof AuthenticationRequiredError ||
        error instanceof PasswordChangeInvalidCurrentPasswordError
      ) {
        throw error;
      }
      logSafeFailure(this.logger, 'password_change.transaction_failed', error);
      throw new PasswordChangeUnavailableError();
    }
    if (!sessionExpiresAt) throw new PasswordChangeUnavailableError();
    return {
      sessionToken: replacement.raw,
      sessionExpiresAt,
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
    logSafeFailure(
      this.logger,
      'password_change.context_resolution_failed',
      failure,
    );
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
      this.users.findById(session.userId),
      this.memberships.find({
        userId: session.userId,
        workspaceId: session.workspaceId,
      }),
    ]);
    if (!user || user.status !== 'ACTIVE' || !membership) {
      throw new AuthenticationRequiredError();
    }
    return { session };
  }

  /** Verifies the current password and returns a stale-write proof. */
  private async verifyCurrentPassword(
    userId: string,
    currentPassword: string,
  ): Promise<VerifiedUserPassword> {
    try {
      const verified = await this.users.verifyPassword({
        userId,
        password: currentPassword,
      });
      if (!verified) throw new PasswordChangeInvalidCurrentPasswordError();
      return verified;
    } catch (error) {
      if (error instanceof PasswordChangeInvalidCurrentPasswordError) {
        throw error;
      }
      logSafeFailure(
        this.logger,
        'password_change.credential_check_failed',
        error,
      );
      throw new PasswordChangeUnavailableError();
    }
  }

  /** Hashes a replacement password through the configured crypto boundary. */
  private async hashReplacement(password: string): Promise<string> {
    try {
      return await this.users.hashPassword(password);
    } catch (error) {
      logSafeFailure(this.logger, 'password_change.hash_failed', error);
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
      current.workspaceId !== expected.session.workspaceId ||
      current.revokedAt ||
      current.expiresAt.getTime() <= now.getTime()
    ) {
      throw new AuthenticationRequiredError();
    }
    const [user, membership] = await Promise.all([
      this.users.findById(current.userId),
      this.memberships.find({
        userId: current.userId,
        workspaceId: current.workspaceId,
      }),
    ]);
    if (!user || user.status !== 'ACTIVE' || !membership) {
      throw new AuthenticationRequiredError();
    }
    return current;
  }
}
