import { AuditService, type AppendAuditLog } from '../../audit/audit.service';
import { AppConfig } from '../../../config/app-config';
import { PasswordCredentialsService } from '../../identity/password-credentials.service';
import {
  MembershipsService,
  type MembershipSummary,
} from '../../memberships/memberships.service';
import { OrganizationsService } from '../../organizations/organizations.service';
import { UsersService } from '../../users/users.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { Clock } from '../../../common/application/clock';
import { IdentifierFactory } from '../../../common/application/identifier-factory';
import type { TransactionManager } from '../../../common/application/transaction-manager.port';
import {
  AuthenticationInvalidError,
  AuthenticationUnavailableError,
  WorkspaceSelectionRequiredError,
} from '../domain/registration.errors';
import { AccessibleWorkspaces } from '../application/accessible-workspaces';
import type { SessionCachePort } from '../application/session-cache.port';
import { SessionTokenService } from '../application/session-token.service';
import { SessionsService } from './sessions.service';

class InlineTransactionManager implements TransactionManager {
  execute<T>(operation: () => Promise<T>): Promise<T> {
    return operation();
  }
}

class RecordingSessionCache implements SessionCachePort {
  stores: string[] = [];

  store(tokenHash: string): Promise<void> {
    this.stores.push(tokenHash);
    return Promise.resolve();
  }

  exists(): Promise<boolean> {
    return Promise.resolve(false);
  }

  remove(): Promise<void> {
    return Promise.resolve();
  }
}

describe('SessionsService.create', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.APP_ORIGINS = 'http://localhost:3000';
    process.env.TRUST_PROXY = '';
    process.env.RATE_LIMIT_KEY_SECRET = 'unit-test-rate-limit-secret-value';
    process.env.COOKIE_SECURE = 'true';
    process.env.SESSION_TTL_SECONDS = '3600';
  });

  it('creates and audits a fresh server-selected session', async () => {
    const fixture = createFixture();

    const result = await fixture.service.create({
      email: ' PERSON@Example.com ',
      password: 'A secure passphrase 123',
    });

    expect(fixture.sessionWrites).toHaveLength(1);
    expect(fixture.sessionWrites[0]).toMatchObject({
      userId: 'user-id',
      activeWorkspaceId: 'workspace-id',
      expiresAt: new Date('2026-08-07T01:00:00.000Z'),
    });
    expect(fixture.audits).toEqual([
      expect.objectContaining({
        workspaceId: 'workspace-id',
        actorUserId: 'user-id',
        action: 'auth.session.created',
        resourceId: fixture.sessionWrites[0].id,
      }),
    ]);
    expect(fixture.sessionCache.stores).toHaveLength(1);
    expect(result).toMatchObject({
      user: { id: 'user-id' },
      workspace: { id: 'workspace-id' },
      membership: { role: 'OWNER' },
    });
  });

  it('returns available workspaces after valid credentials require selection', async () => {
    const fixture = createFixture({
      memberships: [
        { userId: 'user-id', workspaceId: 'workspace-id', role: 'OWNER' },
        { userId: 'user-id', workspaceId: 'workspace-2', role: 'OWNER' },
      ],
    });

    await expect(
      fixture.service.create({
        email: 'person@example.com',
        password: 'A secure passphrase 123',
      }),
    ).rejects.toMatchObject({
      code: 'WORKSPACE_SELECTION_REQUIRED',
      details: {
        availableWorkspaces: [
          {
            organization: { id: 'organization-id', name: 'Example Org' },
            workspace: { id: 'workspace-id', name: 'Main Workspace' },
            membership: { role: 'OWNER' },
          },
          {
            organization: { id: 'organization-2', name: 'Example Org 2' },
            workspace: { id: 'workspace-2', name: 'Workspace 2' },
            membership: { role: 'OWNER' },
          },
        ],
      },
    } satisfies Partial<WorkspaceSelectionRequiredError>);
    expect(fixture.sessionWrites).toHaveLength(0);
    expect(fixture.audits).toHaveLength(0);
  });

  it('creates a session only for an explicitly selected membership', async () => {
    const fixture = createFixture({
      memberships: [
        { userId: 'user-id', workspaceId: 'workspace-id', role: 'OWNER' },
        { userId: 'user-id', workspaceId: 'workspace-2', role: 'OWNER' },
      ],
    });

    const result = await fixture.service.create({
      email: 'person@example.com',
      password: 'A secure passphrase 123',
      workspaceId: 'workspace-2',
    });

    expect(result.workspace).toEqual({
      id: 'workspace-2',
      name: 'Workspace 2',
    });
    expect(fixture.sessionWrites[0]).toMatchObject({
      activeWorkspaceId: 'workspace-2',
    });
  });

  it('keeps an unauthorized workspace selector indistinguishable from invalid credentials', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.create({
        email: 'person@example.com',
        password: 'A secure passphrase 123',
        workspaceId: 'workspace-not-owned',
      }),
    ).rejects.toBeInstanceOf(AuthenticationInvalidError);
    expect(fixture.sessionWrites).toHaveLength(0);
  });

  it('fails safely instead of enumerating an unbounded workspace list', async () => {
    const fixture = createFixture({
      memberships: Array.from({ length: 101 }, (_, index) => ({
        userId: 'user-id',
        workspaceId: `workspace-${index}`,
        role: 'OWNER' as const,
      })),
    });

    await expect(
      fixture.service.create({
        email: 'person@example.com',
        password: 'A secure passphrase 123',
      }),
    ).rejects.toBeInstanceOf(AuthenticationUnavailableError);
    expect(fixture.sessionWrites).toHaveLength(0);
  });
});

function createFixture(options?: { memberships?: MembershipSummary[] }): {
  service: SessionsService;
  sessionWrites: Array<{
    id: string;
    tokenHash: string;
    userId: string;
    activeWorkspaceId: string;
    expiresAt: Date;
  }>;
  audits: AppendAuditLog[];
  sessionCache: RecordingSessionCache;
} {
  const sessionWrites: Array<{
    id: string;
    tokenHash: string;
    userId: string;
    activeWorkspaceId: string;
    expiresAt: Date;
  }> = [];
  const audits: AppendAuditLog[] = [];
  const sessionCache = new RecordingSessionCache();
  const membershipRecords = options?.memberships ?? [
    { userId: 'user-id', workspaceId: 'workspace-id', role: 'OWNER' as const },
  ];
  const passwordIdentities: Pick<PasswordCredentialsService, 'authenticate'> = {
    authenticate: () => Promise.resolve({ identityId: 'identity-id' }),
  };
  const users: Pick<UsersService, 'findActiveByIdentityId'> = {
    findActiveByIdentityId: () =>
      Promise.resolve({
        id: 'user-id',
        displayName: 'Person',
        status: 'ACTIVE',
      }),
  };
  const memberships: Pick<MembershipsService, 'find' | 'listForUser'> = {
    find: (input) =>
      Promise.resolve(
        membershipRecords.find(
          ({ userId, workspaceId }) =>
            userId === input.userId && workspaceId === input.workspaceId,
        ) ?? null,
      ),
    listForUser: () => Promise.resolve(membershipRecords),
  };
  const workspaces: Pick<WorkspacesService, 'findById' | 'findByIds'> = {
    findById: (id) =>
      Promise.resolve(
        id === 'workspace-id'
          ? {
              id,
              organizationId: 'organization-id',
              name: 'Main Workspace',
            }
          : id === 'workspace-2'
            ? { id, organizationId: 'organization-2', name: 'Workspace 2' }
            : null,
      ),
    findByIds: (ids) =>
      Promise.all(
        ids.map((id) =>
          id === 'workspace-id'
            ? Promise.resolve({
                id,
                organizationId: 'organization-id',
                name: 'Main Workspace',
              })
            : Promise.resolve({
                id,
                organizationId: 'organization-2',
                name: 'Workspace 2',
              }),
        ),
      ),
  };
  const organizations = new OrganizationsService({
    create: () => Promise.resolve(),
    findById: (id) =>
      Promise.resolve(
        id === 'organization-id'
          ? { id, name: 'Example Org' }
          : id === 'organization-2'
            ? { id, name: 'Example Org 2' }
            : null,
      ),
    findByIds: (ids) =>
      Promise.resolve(
        ids.map((id) => ({
          id,
          name: id === 'organization-id' ? 'Example Org' : 'Example Org 2',
        })),
      ),
  });
  const accessibleWorkspaces = new AccessibleWorkspaces(
    memberships,
    workspaces,
    organizations,
  );
  const sessions = {
    create: (input: {
      id: string;
      tokenHash: string;
      userId: string;
      activeWorkspaceId: string;
      expiresAt: Date;
    }) => {
      sessionWrites.push(input);
      return Promise.resolve();
    },
    findByTokenHash: () => Promise.resolve(null),
    findLatestForUser: () => Promise.resolve(null),
    revokeByTokenHash: () => Promise.resolve(null),
    revokeAllForUser: () => Promise.resolve([]),
    storeCacheBestEffort: (tokenHash: string) => sessionCache.store(tokenHash),
  };
  const auditLog = new AuditService({
    append: (input) => {
      audits.push(input);
      return Promise.resolve();
    },
  });
  const clock = new Clock();
  jest.spyOn(clock, 'now').mockReturnValue(new Date('2026-08-07T00:00:00Z'));

  return {
    sessionWrites,
    audits,
    sessionCache,
    service: new SessionsService(
      passwordIdentities,
      users as never,
      memberships,
      accessibleWorkspaces,
      sessions as never,
      organizations,
      workspaces,
      auditLog,
      new InlineTransactionManager(),
      new SessionTokenService(),
      new IdentifierFactory(),
      clock,
      new AppConfig(),
    ),
  };
}
