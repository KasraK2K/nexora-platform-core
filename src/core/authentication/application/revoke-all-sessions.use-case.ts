import { Inject, Injectable } from '@nestjs/common';
import { AuditLog } from '../../audit/application/audit-log';
import { Clock } from '../../../shared/application/clock';
import { IdentifierFactory } from '../../../shared/application/identifier-factory';
import { TRANSACTION_MANAGER } from '../../../shared/application/transaction-manager.port';
import type { TransactionManager } from '../../../shared/application/transaction-manager.port';
import {
  AuthenticationRequiredError,
  AuthenticationUnavailableError,
} from '../domain/registration.errors';
import {
  AuthenticationSessions,
  type RevokedSession,
} from './authentication-sessions';
import { SESSION_CACHE } from './session-cache.port';
import type { SessionCachePort } from './session-cache.port';
import { SessionTokenService } from './session-token.service';

@Injectable()
export class RevokeAllSessions {
  constructor(
    private readonly sessions: AuthenticationSessions,
    private readonly auditLog: AuditLog,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
    @Inject(SESSION_CACHE) private readonly sessionCache: SessionCachePort,
    private readonly sessionTokens: SessionTokenService,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
  ) {}

  async execute(rawToken: string | undefined): Promise<void> {
    const tokenHash = this.sessionTokens.hashIfValid(rawToken);
    if (!tokenHash) {
      throw new AuthenticationRequiredError();
    }

    let revokedSessions: RevokedSession[];
    try {
      revokedSessions = await this.transactions.execute(async () => {
        const now = this.clock.now();
        const current = await this.sessions.findByTokenHash(tokenHash);
        if (
          !current ||
          current.revokedAt ||
          current.expiresAt.getTime() <= now.getTime()
        ) {
          throw new AuthenticationRequiredError();
        }

        const revoked = await this.sessions.revokeAllForUser(
          current.userId,
          now,
        );
        const workspaceIds = new Set(
          revoked.map((session) => session.activeWorkspaceId),
        );
        for (const workspaceId of workspaceIds) {
          await this.auditLog.append({
            id: this.identifiers.create(),
            workspaceId,
            actorUserId: current.userId,
            action: 'auth.sessions.revoked_all',
            resourceId: current.userId,
          });
        }
        return revoked;
      });
    } catch (error) {
      if (error instanceof AuthenticationRequiredError) {
        throw error;
      }
      throw new AuthenticationUnavailableError();
    }

    await Promise.all(
      revokedSessions.map((session) =>
        this.sessionCache.remove(session.tokenHash).catch(() => undefined),
      ),
    );
  }
}
