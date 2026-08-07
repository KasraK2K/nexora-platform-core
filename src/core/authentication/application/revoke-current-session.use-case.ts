import { Inject, Injectable } from '@nestjs/common';
import { AuditLog } from '../../audit/application/audit-log';
import { Clock } from '../../../shared/application/clock';
import { IdentifierFactory } from '../../../shared/application/identifier-factory';
import { TRANSACTION_MANAGER } from '../../../shared/application/transaction-manager.port';
import type { TransactionManager } from '../../../shared/application/transaction-manager.port';
import { AuthenticationUnavailableError } from '../domain/registration.errors';
import { AuthenticationSessions } from './authentication-sessions';
import { SESSION_CACHE } from './session-cache.port';
import type { SessionCachePort } from './session-cache.port';
import { SessionTokenService } from './session-token.service';

@Injectable()
export class RevokeCurrentSession {
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
      return;
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await this.transactions.execute(async () => {
          const revoked = await this.sessions.revokeByTokenHash(
            tokenHash,
            this.clock.now(),
          );
          if (!revoked) {
            return;
          }

          await this.auditLog.append({
            id: this.identifiers.create(),
            workspaceId: revoked.activeWorkspaceId,
            actorUserId: revoked.userId,
            action: 'auth.session.revoked',
            resourceId: revoked.id,
          });
        });
        break;
      } catch (error) {
        if (attempt === 0 && isWriteConflict(error)) {
          continue;
        }
        throw new AuthenticationUnavailableError();
      }
    }

    await this.sessionCache.remove(tokenHash).catch(() => undefined);
  }
}

function isWriteConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2034'
  );
}
