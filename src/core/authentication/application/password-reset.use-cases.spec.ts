import {
  AuditLog,
  type AppendAuditLog,
} from '../../audit/application/audit-log';
import { AppConfig } from '../../configuration/app-config';
import { IdentityLookup } from '../../identity/application/identity-lookup';
import { PasswordCredentialManagement } from '../../identity/application/password-credential-management';
import { Users } from '../../users/application/users';
import { Clock } from '../../../shared/application/clock';
import { IdentifierFactory } from '../../../shared/application/identifier-factory';
import type { TransactionManager } from '../../../shared/application/transaction-manager.port';
import {
  InvalidPasswordResetPasswordError,
  PasswordResetInvalidError,
} from '../domain/registration.errors';
import { PasswordPolicy } from '../domain/password-policy';
import { AuthenticationSessions } from './authentication-sessions';
import type { PasswordCompromiseChecker } from './password-compromise-checker.port';
import type { PasswordHasher } from './password-hasher.port';
import { PasswordResetDelivery } from './password-reset-delivery';
import type { PasswordResetSender } from './password-reset-sender.port';
import { PasswordResetTokenService } from './password-reset-token.service';
import {
  PasswordResetTokens,
  type PasswordResetTokensRepository,
} from './password-reset-tokens';
import { RequestPasswordReset } from './request-password-reset.use-case';
import { ResetPassword } from './reset-password.use-case';
import type { SessionCachePort } from './session-cache.port';

class InlineTransactionManager implements TransactionManager {
  execute<T>(operation: () => Promise<T>): Promise<T> {
    return operation();
  }
}

type StoredReset = {
  id: string;
  identityId: string;
  userId: string;
  workspaceId: string;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  invalidatedAt: Date | null;
  deliveryStatus: 'PENDING' | 'SENT' | 'FAILED';
};

class InMemoryResetTokens implements PasswordResetTokensRepository {
  readonly records: StoredReset[] = [];

  create(
    input: Omit<StoredReset, 'consumedAt' | 'invalidatedAt' | 'deliveryStatus'>,
  ): Promise<void> {
    this.records.push({
      ...input,
      consumedAt: null,
      invalidatedAt: null,
      deliveryStatus: 'PENDING',
    });
    return Promise.resolve();
  }

  invalidateOpenForUser(userId: string, invalidatedAt: Date): Promise<void> {
    for (const record of this.records) {
      if (
        record.userId === userId &&
        !record.consumedAt &&
        !record.invalidatedAt
      ) {
        record.invalidatedAt = invalidatedAt;
      }
    }
    return Promise.resolve();
  }

  findUsableByTokenHash(tokenHash: string, now: Date) {
    const record = this.records.find(
      (candidate) =>
        candidate.tokenHash === tokenHash &&
        !candidate.consumedAt &&
        !candidate.invalidatedAt &&
        candidate.expiresAt.getTime() > now.getTime(),
    );
    return Promise.resolve(record ?? null);
  }

  consume(id: string, consumedAt: Date): Promise<boolean> {
    const record = this.records.find(
      (candidate) =>
        candidate.id === id &&
        !candidate.consumedAt &&
        !candidate.invalidatedAt &&
        candidate.expiresAt.getTime() > consumedAt.getTime(),
    );
    if (!record) return Promise.resolve(false);
    record.consumedAt = consumedAt;
    return Promise.resolve(true);
  }

  markDelivery(id: string, status: 'SENT' | 'FAILED'): Promise<void> {
    const record = this.records.find((candidate) => candidate.id === id);
    if (record) record.deliveryStatus = status;
    return Promise.resolve();
  }
}

describe('password reset use cases', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.APP_ORIGINS = 'http://localhost:3000';
    process.env.TRUST_PROXY = '';
    process.env.RATE_LIMIT_KEY_SECRET = 'unit-test-rate-limit-secret-value';
    process.env.COOKIE_SECURE = 'true';
    process.env.PASSWORD_RESET_TTL_SECONDS = '3600';
  });

  it('creates a hashed replacement token and delivers only the raw token', async () => {
    const fixture = createRequestFixture();

    await fixture.useCase.execute(' PERSON@Example.com ');
    const firstToken = fixture.sender.deliveries[0].token;
    await fixture.useCase.execute('person@example.com');

    expect(fixture.repository.records).toHaveLength(2);
    expect(fixture.repository.records[0].invalidatedAt).not.toBeNull();
    expect(fixture.repository.records[1].tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(fixture.repository.records[1].tokenHash).not.toBe(
      fixture.sender.deliveries[1].token,
    );
    expect(fixture.sender.deliveries).toEqual([
      expect.objectContaining({ to: 'person@example.com', token: firstToken }),
      expect.objectContaining({ to: 'person@example.com' }),
    ]);
  });

  it('re-resolves the active workspace inside the reset-request transaction', async () => {
    const fixture = createRequestFixture([
      'former-workspace',
      'active-workspace',
    ]);

    await fixture.useCase.execute('person@example.com');

    expect(fixture.repository.records).toHaveLength(1);
    expect(fixture.repository.records[0].workspaceId).toBe('active-workspace');
  });

  it('replaces the password, revokes every session, audits, and rejects replay', async () => {
    const fixture = createResetFixture();

    await fixture.useCase.execute({
      token: fixture.rawToken,
      newPassword: 'A new secure passphrase 456',
    });

    expect(fixture.passwordHashes).toEqual(['new-password-hash']);
    expect(fixture.revoked).toBe(true);
    expect(fixture.cacheRemovals).toEqual(['a'.repeat(64), 'b'.repeat(64)]);
    expect(fixture.audits.map((audit) => audit.workspaceId).sort()).toEqual([
      'workspace-1',
      'workspace-2',
    ]);
    await expect(
      fixture.useCase.execute({
        token: fixture.rawToken,
        newPassword: 'Another secure passphrase 789',
      }),
    ).rejects.toBeInstanceOf(PasswordResetInvalidError);
  });

  it('rejects a compromised replacement before changing durable state', async () => {
    const fixture = createResetFixture({ compromised: true });

    await expect(
      fixture.useCase.execute({
        token: fixture.rawToken,
        newPassword: 'A compromised passphrase 123',
      }),
    ).rejects.toBeInstanceOf(InvalidPasswordResetPasswordError);
    expect(fixture.passwordHashes).toHaveLength(0);
    expect(fixture.revoked).toBe(false);
    expect(fixture.repository.records[0].consumedAt).toBeNull();
  });
});

function createRequestFixture(latestWorkspaces?: readonly string[]) {
  const repository = new InMemoryResetTokens();
  const resets = new PasswordResetTokens(repository);
  const deliveries: Array<{ to: string; token: string; expiresAt: Date }> = [];
  const sender: PasswordResetSender & {
    deliveries: Array<{ to: string; token: string; expiresAt: Date }>;
  } = {
    deliveries,
    send(input) {
      deliveries.push(input);
      return Promise.resolve();
    },
  };
  const clock = fixedClock();
  const users = activeUsers();
  const sessions = sessionRepository(undefined, latestWorkspaces);

  return {
    repository,
    sender,
    useCase: new RequestPasswordReset(
      new IdentityLookup({
        findByNormalizedEmail: () =>
          Promise.resolve({
            id: 'identity-id',
            normalizedEmail: 'person@example.com',
          }),
        findById: () => Promise.resolve(null),
      }),
      users,
      sessions,
      resets,
      new PasswordResetDelivery(sender, resets, clock),
      new PasswordResetTokenService(),
      new IdentifierFactory(),
      clock,
      new AppConfig(),
      new InlineTransactionManager(),
    ),
  };
}

function createResetFixture(options?: { compromised?: boolean }) {
  const repository = new InMemoryResetTokens();
  const resets = new PasswordResetTokens(repository);
  const tokens = new PasswordResetTokenService();
  const token = tokens.create();
  repository.records.push({
    id: 'reset-id',
    identityId: 'identity-id',
    userId: 'user-id',
    workspaceId: 'workspace-1',
    tokenHash: token.hash,
    expiresAt: new Date('2026-08-08T01:00:00.000Z'),
    consumedAt: null,
    invalidatedAt: null,
    deliveryStatus: 'SENT',
  });
  const passwordHashes: string[] = [];
  const credentials = new PasswordCredentialManagement({
    replacePasswordHash: (_identityId, hash) => {
      passwordHashes.push(hash);
      return Promise.resolve(true);
    },
  });
  let revoked = false;
  const sessions = sessionRepository(() => {
    revoked = true;
  });
  const audits: AppendAuditLog[] = [];
  const auditLog = new AuditLog({
    append(input) {
      audits.push(input);
      return Promise.resolve();
    },
  });
  const cacheRemovals: string[] = [];
  const cache: SessionCachePort = {
    store: () => Promise.resolve(),
    exists: () => Promise.resolve(false),
    remove: (hash) => {
      cacheRemovals.push(hash);
      return Promise.resolve();
    },
  };
  const checker: PasswordCompromiseChecker = {
    isCompromised: () => Promise.resolve(options?.compromised ?? false),
  };
  const hasher: PasswordHasher = {
    hash: () => Promise.resolve('new-password-hash'),
  };

  return {
    rawToken: token.raw,
    repository,
    passwordHashes,
    audits,
    cacheRemovals,
    get revoked() {
      return revoked;
    },
    useCase: new ResetPassword(
      resets,
      credentials,
      activeUsers(),
      sessions,
      auditLog,
      tokens,
      new PasswordPolicy(),
      checker,
      hasher,
      new InlineTransactionManager(),
      cache,
      new IdentifierFactory(),
      fixedClock(),
    ),
  };
}

function activeUsers(): Users {
  return new Users({
    create: () => Promise.resolve(),
    findById: () =>
      Promise.resolve({
        id: 'user-id',
        displayName: 'Person',
        status: 'ACTIVE',
      }),
    findAuthenticationReferenceById: () => Promise.resolve(null),
    findByIdentityId: () =>
      Promise.resolve({
        id: 'user-id',
        displayName: 'Person',
        status: 'ACTIVE',
      }),
    findActiveByIdentityId: () =>
      Promise.resolve({
        id: 'user-id',
        displayName: 'Person',
        status: 'ACTIVE',
      }),
    activate: () => Promise.resolve(false),
    updateDisplayName: () => Promise.resolve(false),
  });
}

function sessionRepository(
  onRevoke?: () => void,
  latestWorkspaces: readonly string[] = ['workspace-1'],
): AuthenticationSessions {
  let latestWorkspaceIndex = 0;
  return new AuthenticationSessions({
    create: () => Promise.resolve(),
    findByTokenHash: () => Promise.resolve(null),
    findLatestForUser: () => {
      const activeWorkspaceId =
        latestWorkspaces[
          Math.min(latestWorkspaceIndex, latestWorkspaces.length - 1)
        ];
      latestWorkspaceIndex += 1;
      return Promise.resolve({ userId: 'user-id', activeWorkspaceId });
    },
    revokeByTokenHash: () => Promise.resolve(null),
    revokeAllForUser: () => {
      onRevoke?.();
      return Promise.resolve([
        {
          id: 'session-1',
          tokenHash: 'a'.repeat(64),
          userId: 'user-id',
          activeWorkspaceId: 'workspace-1',
        },
        {
          id: 'session-2',
          tokenHash: 'b'.repeat(64),
          userId: 'user-id',
          activeWorkspaceId: 'workspace-2',
        },
      ]);
    },
  });
}

function fixedClock(): Clock {
  const clock = new Clock();
  jest
    .spyOn(clock, 'now')
    .mockReturnValue(new Date('2026-08-08T00:00:00.000Z'));
  return clock;
}
