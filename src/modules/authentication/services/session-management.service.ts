import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { Clock } from '../../../common/clock';
import { IdentifierFactory } from '../../../common/identifier-factory';
import { TRANSACTION_MANAGER } from '../../../common/transaction-manager';
import type { TransactionManager } from '../../../common/transaction-manager';
import { isTransactionWriteConflict } from '../../../common/transaction-write-conflict';
import {
  AuthenticationRequiredError,
  AuthenticationUnavailableError,
} from '../errors/authentication.errors';
import { OpaqueTokenService } from '../../../common/security/opaque-token.service';
import type { RevokedSession } from '../repositories/authentication-sessions.repository';
import { SessionStoreService } from '../services/session-store.service';

/** Owns idempotent current-session and authenticated all-session revocation. */
@Injectable()
export class SessionManagementService {
  constructor(
    private readonly sessions: SessionStoreService,
    private readonly audit: AuditService,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
    private readonly sessionTokens: OpaqueTokenService,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
  ) {}

  /** Idempotently revokes the presented session. */
  async revokeCurrent(rawToken: string | undefined): Promise<void> {
    const tokenHash = this.sessionTokens.hashIfValid(rawToken);
    if (!tokenHash) return;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await this.transactions.execute(async () => {
          const revoked = await this.sessions.revokeByTokenHash(
            tokenHash,
            this.clock.now(),
          );
          if (!revoked) return;
          await this.audit.append({
            id: this.identifiers.create(),
            workspaceId: revoked.activeWorkspaceId,
            actorUserId: revoked.userId,
            action: 'auth.session.revoked',
            resourceId: revoked.id,
          });
        });
        break;
      } catch (error) {
        if (attempt === 0 && isTransactionWriteConflict(error)) continue;
        throw new AuthenticationUnavailableError();
      }
    }
    await this.sessions.removeCacheBestEffort(tokenHash);
  }

  /** Revokes every durable session owned by the authenticated user. */
  async revokeAll(rawToken: string | undefined): Promise<void> {
    const tokenHash = this.sessionTokens.hashIfValid(rawToken);
    if (!tokenHash) throw new AuthenticationRequiredError();
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
          await this.audit.append({
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
      if (error instanceof AuthenticationRequiredError) throw error;
      throw new AuthenticationUnavailableError();
    }
    await Promise.all(
      revokedSessions.map((session) =>
        this.sessions.removeCacheBestEffort(session.tokenHash),
      ),
    );
  }
}
