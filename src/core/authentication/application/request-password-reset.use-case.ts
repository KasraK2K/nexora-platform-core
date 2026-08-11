import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../configuration/app-config';
import {
  IdentityLookup,
  type IdentitySummary,
} from '../../identity/application/identity-lookup';
import { Users, type UserSummary } from '../../users/application/users';
import { Clock } from '../../../shared/application/clock';
import { IdentifierFactory } from '../../../shared/application/identifier-factory';
import { TRANSACTION_MANAGER } from '../../../shared/application/transaction-manager.port';
import type { TransactionManager } from '../../../shared/application/transaction-manager.port';
import { PasswordResetUnavailableError } from '../domain/registration.errors';
import {
  AuthenticationSessions,
  type SessionContext,
} from './authentication-sessions';
import { PasswordResetDelivery } from './password-reset-delivery';
import { PasswordResetTokenService } from './password-reset-token.service';
import { PasswordResetTokens } from './password-reset-tokens';

@Injectable()
export class RequestPasswordReset {
  private readonly logger = new Logger(RequestPasswordReset.name);

  constructor(
    private readonly identities: IdentityLookup,
    private readonly users: Users,
    private readonly sessions: AuthenticationSessions,
    private readonly resetTokens: PasswordResetTokens,
    private readonly delivery: PasswordResetDelivery,
    private readonly tokens: PasswordResetTokenService,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
    private readonly config: AppConfig,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
  ) {}

  async execute(email: string): Promise<void> {
    let identity: IdentitySummary | null;
    try {
      identity = await this.identities.findByEmail(email);
    } catch {
      throw new PasswordResetUnavailableError();
    }
    if (!identity) {
      return;
    }

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
    if (!user || user.status !== 'ACTIVE' || !sessionContext) {
      return;
    }

    const token = this.tokens.create();
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
        return true;
      });
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'password_reset.request_failed',
          errorType: error instanceof Error ? error.name : 'UnknownError',
        }),
      );
      throw new PasswordResetUnavailableError();
    }

    if (created) {
      await this.delivery.attempt({
        resetId,
        email: identity.normalizedEmail,
        token: token.raw,
        expiresAt,
      });
    }
  }
}
