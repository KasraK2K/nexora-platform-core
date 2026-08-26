import { AuditService, type AppendAuditLog } from '../../audit/audit.service';
import { AppConfig } from '../../../config/app-config';
import { PasswordCredentialsService } from '../../identity/password-credentials.service';
import { UsersService } from '../../users/users.service';
import { Clock } from '../../../common/clock';
import { IdentifierFactory } from '../../../common/identifier-factory';
import type { TransactionManager } from '../../../common/transaction-manager';
import {
  InvalidPasswordResetPasswordError,
  PasswordResetInvalidError,
} from '../errors/authentication.errors';
import { PasswordPolicy } from '../security/password-policy';
import type { AuthenticationSessionsRepository } from '../repositories/authentication-sessions.repository';
import type { PasswordCompromiseChecker } from '../security/password-compromise-checker';
import type { PasswordHasher } from '../security/password-hasher';
import { PasswordResetDeliveryService } from '../mail/password-reset-delivery.service';
import { OpaqueTokenService } from '../../../common/security/opaque-token.service';
import type { SessionCachePort } from '../cache/session-cache';
import { PasswordResetService } from './password-reset.service';

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

class InMemoryResetTokens {
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

describe('PasswordResetService', () => {
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

    await fixture.service.requestReset(' PERSON@Example.com ');
    const firstToken = fixture.sender.deliveries[0].token;
    await fixture.service.requestReset('person@example.com');

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

    await fixture.service.requestReset('person@example.com');

    expect(fixture.repository.records).toHaveLength(1);
    expect(fixture.repository.records[0].workspaceId).toBe('active-workspace');
  });

  it('replaces the password, revokes every session, audits, and rejects replay', async () => {
    const fixture = createResetFixture();

    await fixture.service.reset({
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
      fixture.service.reset({
        token: fixture.rawToken,
        newPassword: 'Another secure passphrase 789',
      }),
    ).rejects.toBeInstanceOf(PasswordResetInvalidError);
  });

  it('rejects a compromised replacement before changing durable state', async () => {
    const fixture = createResetFixture({ compromised: true });

    await expect(
      fixture.service.reset({
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
  const deliveries: Array<{ to: string; token: string; expiresAt: Date }> = [];
  const sender: {
    deliveries: Array<{ to: string; token: string; expiresAt: Date }>;
    send(input: { to: string; token: string; expiresAt: Date }): Promise<void>;
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
  const config = new AppConfig();
  let queuedMail: { to: string; text: string; expiresAt: Date } | undefined;
  const outbox = {
    enqueue(input: { to: string; text: string; expiresAt: Date }) {
      queuedMail = input;
      return Promise.resolve();
    },
    async deliverNow(): Promise<boolean> {
      const match = queuedMail?.text.match(/#token=([^\s]+)/);
      if (queuedMail && match) {
        await sender.send({
          to: queuedMail.to,
          token: decodeURIComponent(match[1]),
          expiresAt: queuedMail.expiresAt,
        });
        return true;
      }
      return false;
    },
  };

  return {
    repository,
    sender,
    service: new PasswordResetService(
      {
        findByEmail: () =>
          Promise.resolve({
            id: 'identity-id',
            normalizedEmail: 'person@example.com',
          }),
      } as never,
      users as never,
      sessions as never,
      repository as never,
      new PasswordResetDeliveryService(
        outbox as never,
        repository as never,
        clock,
        config,
      ),
      new OpaqueTokenService(),
      undefined as never,
      undefined as never,
      new PasswordPolicy(),
      undefined as never,
      undefined as never,
      new InlineTransactionManager(),
      new IdentifierFactory(),
      clock,
      config,
    ),
  };
}

function createResetFixture(options?: { compromised?: boolean }) {
  const repository = new InMemoryResetTokens();
  const tokens = new OpaqueTokenService();
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
  const credentials: Pick<PasswordCredentialsService, 'replacePasswordHash'> = {
    replacePasswordHash: (_identityId, hash) => {
      passwordHashes.push(hash);
      return Promise.resolve(true);
    },
  };
  let revoked = false;
  const sessions = sessionRepository(() => {
    revoked = true;
  });
  const audits: AppendAuditLog[] = [];
  const auditLog = new AuditService({
    append(input: AppendAuditLog) {
      audits.push(input);
      return Promise.resolve();
    },
  } as never);
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
    service: new PasswordResetService(
      undefined as never,
      activeUsers() as never,
      {
        ...sessions,
        removeCacheBestEffort: (hash: string) => cache.remove(hash),
      } as never,
      repository as never,
      undefined as never,
      tokens,
      credentials as never,
      auditLog,
      new PasswordPolicy(),
      checker,
      hasher,
      new InlineTransactionManager(),
      new IdentifierFactory(),
      fixedClock(),
      undefined as never,
    ),
  };
}

function activeUsers(): Pick<UsersService, 'findById' | 'findByIdentityId'> {
  return {
    findById: () =>
      Promise.resolve({
        id: 'user-id',
        displayName: 'Person',
        status: 'ACTIVE',
      }),
    findByIdentityId: () =>
      Promise.resolve({
        id: 'user-id',
        displayName: 'Person',
        status: 'ACTIVE',
      }),
  };
}

function sessionRepository(
  onRevoke?: () => void,
  latestWorkspaces: readonly string[] = ['workspace-1'],
): Pick<
  AuthenticationSessionsRepository,
  | 'create'
  | 'findByTokenHash'
  | 'findLatestForUser'
  | 'revokeByTokenHash'
  | 'revokeAllForUser'
> {
  let latestWorkspaceIndex = 0;
  return {
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
  };
}

function fixedClock(): Clock {
  const clock = new Clock();
  jest
    .spyOn(clock, 'now')
    .mockReturnValue(new Date('2026-08-08T00:00:00.000Z'));
  return clock;
}
