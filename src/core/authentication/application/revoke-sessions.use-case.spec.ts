import {
  AuditLog,
  type AppendAuditLog,
} from '../../audit/application/audit-log';
import { Clock } from '../../../shared/application/clock';
import { IdentifierFactory } from '../../../shared/application/identifier-factory';
import type { TransactionManager } from '../../../shared/application/transaction-manager.port';
import {
  AuthenticationSessions,
  type AuthenticationSessionsRepository,
  type RevokedSession,
  type SessionRecord,
} from './authentication-sessions';
import { RevokeAllSessions } from './revoke-all-sessions.use-case';
import { RevokeCurrentSession } from './revoke-current-session.use-case';
import type { SessionCachePort } from './session-cache.port';
import { SessionTokenService } from './session-token.service';

const RAW_TOKEN = 'a'.repeat(43);

class InlineTransactionManager implements TransactionManager {
  execute<T>(operation: () => Promise<T>): Promise<T> {
    return operation();
  }
}

class RecordingCache implements SessionCachePort {
  removed: string[] = [];

  store(): Promise<void> {
    return Promise.resolve();
  }

  exists(): Promise<boolean> {
    return Promise.resolve(false);
  }

  remove(tokenHash: string): Promise<void> {
    this.removed.push(tokenHash);
    return Promise.resolve();
  }
}

describe('session revocation use cases', () => {
  it('revokes and audits the current session once while repeated logout remains idempotent', async () => {
    const fixture = createFixture();

    await fixture.revokeCurrent.execute(RAW_TOKEN);
    await fixture.revokeCurrent.execute(RAW_TOKEN);

    expect(fixture.audits).toEqual([
      expect.objectContaining({
        action: 'auth.session.revoked',
        resourceId: 'session-1',
        actorUserId: 'user-1',
        workspaceId: 'workspace-1',
      }),
    ]);
    expect(fixture.cache.removed).toHaveLength(2);
  });

  it('revokes all user sessions and writes one tenant-scoped audit per workspace', async () => {
    const fixture = createFixture();

    await fixture.revokeAll.execute(RAW_TOKEN);

    expect(fixture.audits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'auth.sessions.revoked_all',
          workspaceId: 'workspace-1',
          resourceId: 'user-1',
        }),
        expect.objectContaining({
          action: 'auth.sessions.revoked_all',
          workspaceId: 'workspace-2',
          resourceId: 'user-1',
        }),
      ]),
    );
    expect(fixture.cache.removed).toHaveLength(2);
  });
});

function createFixture(): {
  revokeCurrent: RevokeCurrentSession;
  revokeAll: RevokeAllSessions;
  audits: AppendAuditLog[];
  cache: RecordingCache;
} {
  const tokenHash = new SessionTokenService().hash(RAW_TOKEN);
  const activeSession: SessionRecord = {
    id: 'session-1',
    tokenHash,
    userId: 'user-1',
    activeWorkspaceId: 'workspace-1',
    expiresAt: new Date('2026-08-08T00:00:00Z'),
    revokedAt: null,
  };
  const revokedSessions: RevokedSession[] = [
    {
      id: 'session-1',
      tokenHash,
      userId: 'user-1',
      activeWorkspaceId: 'workspace-1',
    },
    {
      id: 'session-2',
      tokenHash: 'b'.repeat(64),
      userId: 'user-1',
      activeWorkspaceId: 'workspace-2',
    },
  ];
  let currentRevoked = false;
  const repository: AuthenticationSessionsRepository = {
    create: () => Promise.resolve(),
    findByTokenHash: () => Promise.resolve(activeSession),
    revokeByTokenHash: () => {
      if (currentRevoked) {
        return Promise.resolve(null);
      }
      currentRevoked = true;
      return Promise.resolve(revokedSessions[0]);
    },
    revokeAllForUser: () => Promise.resolve(revokedSessions),
  };
  const sessions = new AuthenticationSessions(repository);
  const audits: AppendAuditLog[] = [];
  const auditLog = new AuditLog({
    append(input) {
      audits.push(input);
      return Promise.resolve();
    },
  });
  const cache = new RecordingCache();
  const clock = new Clock();
  jest.spyOn(clock, 'now').mockReturnValue(new Date('2026-08-07T00:00:00Z'));
  const transactions = new InlineTransactionManager();
  const sessionTokens = new SessionTokenService();
  const identifiers = new IdentifierFactory();

  return {
    audits,
    cache,
    revokeCurrent: new RevokeCurrentSession(
      sessions,
      auditLog,
      transactions,
      cache,
      sessionTokens,
      identifiers,
      clock,
    ),
    revokeAll: new RevokeAllSessions(
      sessions,
      auditLog,
      transactions,
      cache,
      sessionTokens,
      identifiers,
      clock,
    ),
  };
}
