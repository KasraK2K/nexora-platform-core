import { AuditService, type AppendAuditLog } from '../../audit/audit.service';
import { Clock } from '../../../common/application/clock';
import { IdentifierFactory } from '../../../common/application/identifier-factory';
import type { TransactionManager } from '../../../common/application/transaction-manager.port';
import {
  type AuthenticationSessionsRepository,
  type RevokedSession,
  type SessionRecord,
} from '../repositories/authentication-sessions.repository';
import type { SessionCachePort } from '../application/session-cache.port';
import { SessionTokenService } from '../application/session-token.service';
import { SessionsService } from './sessions.service';

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

describe('SessionsService revocation', () => {
  it('revokes and audits the current session once while repeated logout remains idempotent', async () => {
    const fixture = createFixture();

    await fixture.service.revokeCurrent(RAW_TOKEN);
    await fixture.service.revokeCurrent(RAW_TOKEN);

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

    await fixture.service.revokeAll(RAW_TOKEN);

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
  service: SessionsService;
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
    findLatestForUser: () => Promise.resolve(null),
    revokeByTokenHash: () => {
      if (currentRevoked) {
        return Promise.resolve(null);
      }
      currentRevoked = true;
      return Promise.resolve(revokedSessions[0]);
    },
    revokeAllForUser: () => Promise.resolve(revokedSessions),
  };
  const audits: AppendAuditLog[] = [];
  const auditLog = new AuditService({
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
    service: new SessionsService(
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      {
        ...repository,
        removeCacheBestEffort: (hash: string) => cache.remove(hash),
      } as never,
      undefined as never,
      undefined as never,
      auditLog,
      transactions,
      sessionTokens,
      identifiers,
      clock,
      undefined as never,
    ),
  };
}
