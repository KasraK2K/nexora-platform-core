import { AuditService, type AppendAuditLog } from '../../audit/audit.service';
import { MembershipsService } from '../../memberships/memberships.service';
import { OrganizationsService } from '../../organizations/organizations.service';
import { UsersService } from '../../users/users.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { Clock } from '../../../common/application/clock';
import { IdentifierFactory } from '../../../common/application/identifier-factory';
import type { TransactionManager } from '../../../common/application/transaction-manager.port';
import { WorkspaceAccessDeniedError } from '../domain/registration.errors';
import { AccessibleWorkspaces } from '../application/accessible-workspaces';
import type { AuthenticatedRequestContext } from '../application/authenticated-request-context';
import {
  type AuthenticationSessionsRepository,
  type RevokedSession,
  type SessionRecord,
} from '../repositories/authentication-sessions.repository';
import type { SessionCachePort } from '../application/session-cache.port';
import { SessionTokenService } from '../application/session-token.service';
import { SessionsService } from './sessions.service';

const RAW_TOKEN = 'a'.repeat(43);
const NOW = new Date('2026-08-10T00:00:00.000Z');
const EXPIRES_AT = new Date('2026-08-10T12:00:00.000Z');
const EXPECTED_CONTEXT: AuthenticatedRequestContext = Object.freeze({
  sessionId: 'session-current',
  actorUserId: 'user-1',
  userStatus: 'ACTIVE',
  organizationId: 'organization-1',
  workspaceId: 'workspace-1',
});

class InlineTransactionManager implements TransactionManager {
  execute<T>(operation: () => Promise<T>): Promise<T> {
    return operation();
  }
}

class RecordingSessionsRepository implements AuthenticationSessionsRepository {
  readonly sessions: SessionRecord[];

  constructor(tokenHash: string) {
    this.sessions = [
      {
        id: EXPECTED_CONTEXT.sessionId,
        tokenHash,
        userId: EXPECTED_CONTEXT.actorUserId,
        activeWorkspaceId: EXPECTED_CONTEXT.workspaceId,
        expiresAt: EXPIRES_AT,
        revokedAt: null,
      },
    ];
  }

  create(input: Omit<SessionRecord, 'revokedAt'>): Promise<void> {
    this.sessions.push({ ...input, revokedAt: null });
    return Promise.resolve();
  }

  findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return Promise.resolve(
      this.sessions.find((session) => session.tokenHash === tokenHash) ?? null,
    );
  }

  findLatestForUser(): Promise<null> {
    return Promise.resolve(null);
  }

  revokeByTokenHash(
    tokenHash: string,
    revokedAt: Date,
  ): Promise<RevokedSession | null> {
    const session = this.sessions.find(
      (candidate) =>
        candidate.tokenHash === tokenHash && candidate.revokedAt === null,
    );
    if (!session) {
      return Promise.resolve(null);
    }
    session.revokedAt = revokedAt;
    return Promise.resolve({
      id: session.id,
      tokenHash: session.tokenHash,
      userId: session.userId,
      activeWorkspaceId: session.activeWorkspaceId,
    });
  }

  revokeAllForUser(): Promise<RevokedSession[]> {
    return Promise.resolve([]);
  }
}

class RecordingSessionCache implements SessionCachePort {
  readonly removed: string[] = [];
  readonly stored: Array<{
    tokenHash: string;
    workspaceId: string;
    expiresAt: Date;
  }> = [];

  store(
    tokenHash: string,
    session: { userId: string; workspaceId: string },
    expiresAt: Date,
  ): Promise<void> {
    this.stored.push({
      tokenHash,
      workspaceId: session.workspaceId,
      expiresAt,
    });
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

describe('SwitchWorkspace', () => {
  it('atomically rotates the session into an authorized workspace', async () => {
    const fixture = createFixture();

    const result = await fixture.service.switchWorkspace({
      rawSessionToken: RAW_TOKEN,
      expectedContext: EXPECTED_CONTEXT,
      workspaceId: 'workspace-2',
    });

    expect(result.rotated).toBe(true);
    expect(result.sessionToken).not.toBe(RAW_TOKEN);
    expect(result.sessionExpiresAt).toEqual(EXPIRES_AT);
    expect(result.currentSession).toMatchObject({
      organization: { id: 'organization-2' },
      workspace: { id: 'workspace-2' },
    });
    expect(fixture.sessions.sessions).toHaveLength(2);
    expect(fixture.sessions.sessions[0].revokedAt).toEqual(NOW);
    expect(fixture.sessions.sessions[1]).toMatchObject({
      userId: 'user-1',
      activeWorkspaceId: 'workspace-2',
      expiresAt: EXPIRES_AT,
      revokedAt: null,
    });
    expect(fixture.audits.map((audit) => audit.workspaceId)).toEqual([
      'workspace-1',
      'workspace-2',
    ]);
    expect(fixture.cache.removed).toEqual([
      new SessionTokenService().hash(RAW_TOKEN),
    ]);
    expect(fixture.cache.stored).toEqual([
      expect.objectContaining({
        workspaceId: 'workspace-2',
        expiresAt: EXPIRES_AT,
      }),
    ]);
  });

  it('denies a workspace without changing the current session', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.switchWorkspace({
        rawSessionToken: RAW_TOKEN,
        expectedContext: EXPECTED_CONTEXT,
        workspaceId: 'workspace-not-owned',
      }),
    ).rejects.toBeInstanceOf(WorkspaceAccessDeniedError);
    expect(fixture.sessions.sessions).toHaveLength(1);
    expect(fixture.sessions.sessions[0].revokedAt).toBeNull();
    expect(fixture.audits).toHaveLength(0);
    expect(fixture.cache.removed).toHaveLength(0);
  });

  it('is idempotent when the requested workspace is already active', async () => {
    const fixture = createFixture();

    const result = await fixture.service.switchWorkspace({
      rawSessionToken: RAW_TOKEN,
      expectedContext: EXPECTED_CONTEXT,
      workspaceId: 'workspace-1',
    });

    expect(result).toMatchObject({
      rotated: false,
      sessionToken: RAW_TOKEN,
      sessionExpiresAt: EXPIRES_AT,
    });
    expect(fixture.sessions.sessions).toHaveLength(1);
    expect(fixture.sessions.sessions[0].revokedAt).toBeNull();
    expect(fixture.audits).toHaveLength(0);
    expect(fixture.cache.removed).toHaveLength(0);
    expect(fixture.cache.stored).toHaveLength(0);
  });
});

function createFixture(): {
  service: SessionsService;
  sessions: RecordingSessionsRepository;
  audits: AppendAuditLog[];
  cache: RecordingSessionCache;
} {
  const sessionTokens = new SessionTokenService();
  const sessions = new RecordingSessionsRepository(
    sessionTokens.hash(RAW_TOKEN),
  );
  const membershipRecords = [
    { userId: 'user-1', workspaceId: 'workspace-1', role: 'OWNER' as const },
    { userId: 'user-1', workspaceId: 'workspace-2', role: 'OWNER' as const },
  ];
  const memberships: Pick<MembershipsService, 'find' | 'listForUser'> = {
    find: (input) =>
      Promise.resolve(
        membershipRecords.find(
          (membership) =>
            membership.userId === input.userId &&
            membership.workspaceId === input.workspaceId,
        ) ?? null,
      ),
    listForUser: () => Promise.resolve(membershipRecords),
  };
  const workspaces: Pick<WorkspacesService, 'findById' | 'findByIds'> = {
    findById: (id) =>
      Promise.resolve(
        id === 'workspace-1'
          ? { id, organizationId: 'organization-1', name: 'Workspace 1' }
          : id === 'workspace-2'
            ? { id, organizationId: 'organization-2', name: 'Workspace 2' }
            : null,
      ),
    findByIds: (ids) =>
      Promise.resolve(
        ids.map((id) => ({
          id,
          organizationId:
            id === 'workspace-1' ? 'organization-1' : 'organization-2',
          name: id === 'workspace-1' ? 'Workspace 1' : 'Workspace 2',
        })),
      ),
  };
  const organizations = new OrganizationsService({
    create: () => Promise.resolve(),
    findById: (id) =>
      Promise.resolve(
        id === 'organization-1'
          ? { id, name: 'Organization 1' }
          : id === 'organization-2'
            ? { id, name: 'Organization 2' }
            : null,
      ),
    findByIds: (ids) =>
      Promise.resolve(
        ids.map((id) => ({
          id,
          name: id === 'organization-1' ? 'Organization 1' : 'Organization 2',
        })),
      ),
  });
  const accessibleWorkspaces = new AccessibleWorkspaces(
    memberships,
    workspaces,
    organizations,
  );
  const users: Pick<UsersService, 'findById'> = {
    findById: () =>
      Promise.resolve({ id: 'user-1', displayName: 'User', status: 'ACTIVE' }),
  };
  const audits: AppendAuditLog[] = [];
  const auditLog = new AuditService({
    append(input) {
      audits.push(input);
      return Promise.resolve();
    },
  });
  const cache = new RecordingSessionCache();
  const clock = new Clock();
  jest.spyOn(clock, 'now').mockReturnValue(NOW);

  return {
    sessions,
    audits,
    cache,
    service: new SessionsService(
      undefined as never,
      users as never,
      memberships,
      accessibleWorkspaces,
      {
        findByTokenHash: (hash: string) => sessions.findByTokenHash(hash),
        revokeByTokenHash: (hash: string, at: Date) =>
          sessions.revokeByTokenHash(hash, at),
        create: (
          input: Parameters<AuthenticationSessionsRepository['create']>[0],
        ) => sessions.create(input),
        removeCacheBestEffort: (hash: string) => cache.remove(hash),
        storeCacheBestEffort: (
          hash: string,
          value: { userId: string; workspaceId: string },
          expiresAt: Date,
        ) => cache.store(hash, value, expiresAt),
      } as never,
      organizations,
      workspaces,
      auditLog,
      new InlineTransactionManager(),
      sessionTokens,
      new IdentifierFactory(),
      clock,
      undefined as never,
    ),
  };
}
