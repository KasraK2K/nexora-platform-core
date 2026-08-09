import {
  AuditLog,
  type AppendAuditLog,
} from '../../audit/application/audit-log';
import {
  PasswordCredentialVerification,
  type PasswordCredentialVerificationRepository,
} from '../../identity/application/password-credential-verification';
import type { PasswordVerifier } from '../../identity/application/password-verifier.port';
import { Memberships } from '../../memberships/application/memberships';
import { Users } from '../../users/application/users';
import { Clock } from '../../../shared/application/clock';
import { IdentifierFactory } from '../../../shared/application/identifier-factory';
import type { TransactionManager } from '../../../shared/application/transaction-manager.port';
import { PasswordPolicy } from '../domain/password-policy';
import {
  AuthenticationRequiredError,
  InvalidPasswordChangePasswordError,
  PasswordChangeInvalidCurrentPasswordError,
} from '../domain/registration.errors';
import {
  AuthenticationSessions,
  type AuthenticationSessionsRepository,
  type RevokedSession,
  type SessionRecord,
} from './authentication-sessions';
import { ChangePassword } from './change-password.use-case';
import type { PasswordCompromiseChecker } from './password-compromise-checker.port';
import type { PasswordHasher } from './password-hasher.port';
import {
  PasswordResetTokens,
  type PasswordResetTokensRepository,
} from './password-reset-tokens';
import type { SessionCachePort } from './session-cache.port';
import { SessionTokenService } from './session-token.service';

const RAW_TOKEN = 'a'.repeat(43);
const CURRENT_PASSWORD = 'A secure passphrase 123';
const NEW_PASSWORD = 'A replacement passphrase 456';
const NOW = new Date('2026-08-09T00:00:00.000Z');
const EXPIRES_AT = new Date('2026-08-09T12:00:00.000Z');

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
        id: 'session-current',
        tokenHash,
        userId: 'user-1',
        activeWorkspaceId: 'workspace-1',
        expiresAt: EXPIRES_AT,
        revokedAt: null,
      },
      {
        id: 'session-other',
        tokenHash: 'b'.repeat(64),
        userId: 'user-1',
        activeWorkspaceId: 'workspace-2',
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

  revokeByTokenHash(): Promise<null> {
    return Promise.resolve(null);
  }

  revokeAllForUser(userId: string, revokedAt: Date): Promise<RevokedSession[]> {
    const revoked: RevokedSession[] = [];
    for (const session of this.sessions) {
      if (session.userId !== userId || session.revokedAt) continue;
      session.revokedAt = revokedAt;
      revoked.push({
        id: session.id,
        tokenHash: session.tokenHash,
        userId: session.userId,
        activeWorkspaceId: session.activeWorkspaceId,
      });
    }
    return Promise.resolve(revoked);
  }
}

class RecordingCredentialRepository implements PasswordCredentialVerificationRepository {
  casAllowed = true;
  replacements: string[] = [];

  findByIdentityId() {
    return Promise.resolve({
      identityId: 'identity-1',
      passwordHash: 'stored-old-hash',
    });
  }

  replacePasswordHashIfCurrent(input: {
    identityId: string;
    expectedPasswordHash: string;
    passwordHash: string;
  }): Promise<boolean> {
    if (!this.casAllowed || input.expectedPasswordHash !== 'stored-old-hash') {
      return Promise.resolve(false);
    }
    this.replacements.push(input.passwordHash);
    return Promise.resolve(true);
  }
}

class RecordingResetTokensRepository implements PasswordResetTokensRepository {
  invalidations: Array<{ userId: string; invalidatedAt: Date }> = [];

  create(): Promise<void> {
    return Promise.resolve();
  }

  invalidateOpenForUser(userId: string, invalidatedAt: Date): Promise<void> {
    this.invalidations.push({ userId, invalidatedAt });
    return Promise.resolve();
  }

  findUsableByTokenHash(): Promise<null> {
    return Promise.resolve(null);
  }

  consume(): Promise<boolean> {
    return Promise.resolve(false);
  }

  markDelivery(): Promise<void> {
    return Promise.resolve();
  }
}

class RecordingSessionCache implements SessionCachePort {
  removed: string[] = [];
  stored: string[] = [];
  fail = false;

  store(tokenHash: string): Promise<void> {
    this.stored.push(tokenHash);
    return this.fail
      ? Promise.reject(new Error('cache unavailable'))
      : Promise.resolve();
  }

  exists(): Promise<boolean> {
    return Promise.resolve(false);
  }

  remove(tokenHash: string): Promise<void> {
    this.removed.push(tokenHash);
    return this.fail
      ? Promise.reject(new Error('cache unavailable'))
      : Promise.resolve();
  }
}

describe('ChangePassword', () => {
  it('atomically replaces the credential, invalidates reset links, and rotates all sessions', async () => {
    const fixture = createFixture();

    const result = await fixture.useCase.execute({
      rawSessionToken: RAW_TOKEN,
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
    });

    expect(fixture.credentials.replacements).toEqual(['stored-new-hash']);
    expect(fixture.resetTokens.invalidations).toEqual([
      { userId: 'user-1', invalidatedAt: NOW },
    ]);
    const active = fixture.sessions.sessions.filter(
      (session) => !session.revokedAt,
    );
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({
      userId: 'user-1',
      activeWorkspaceId: 'workspace-1',
      expiresAt: EXPIRES_AT,
    });
    expect(active[0].tokenHash).not.toBe(
      new SessionTokenService().hash(RAW_TOKEN),
    );
    expect(result.sessionExpiresAt).toBe(EXPIRES_AT);
    expect(fixture.audits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'password.change.completed',
          workspaceId: 'workspace-1',
        }),
        expect.objectContaining({
          action: 'password.change.completed',
          workspaceId: 'workspace-2',
        }),
      ]),
    );
    expect(fixture.cache.removed).toHaveLength(2);
    expect(fixture.cache.stored).toEqual([active[0].tokenHash]);
  });

  it('rejects an incorrect or stale current password without changing durable state', async () => {
    const wrong = createFixture({ currentPasswordMatches: false });
    await expect(
      wrong.useCase.execute({
        rawSessionToken: RAW_TOKEN,
        currentPassword: 'A wrong passphrase 123',
        newPassword: NEW_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(PasswordChangeInvalidCurrentPasswordError);
    expect(wrong.credentials.replacements).toHaveLength(0);
    expect(wrong.resetTokens.invalidations).toHaveLength(0);

    const stale = createFixture();
    stale.credentials.casAllowed = false;
    await expect(
      stale.useCase.execute({
        rawSessionToken: RAW_TOKEN,
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(PasswordChangeInvalidCurrentPasswordError);
    expect(stale.resetTokens.invalidations).toHaveLength(0);
  });

  it('rejects missing, revoked, expired, inactive, and membership-less sessions before writes', async () => {
    const cases: Array<{
      fixture: ReturnType<typeof createFixture>;
      rawSessionToken: string | undefined;
    }> = [];

    cases.push({ fixture: createFixture(), rawSessionToken: undefined });
    const revoked = createFixture();
    revoked.sessions.sessions[0].revokedAt = NOW;
    cases.push({ fixture: revoked, rawSessionToken: RAW_TOKEN });
    const expired = createFixture();
    expired.sessions.sessions[0].expiresAt = NOW;
    cases.push({ fixture: expired, rawSessionToken: RAW_TOKEN });
    cases.push({
      fixture: createFixture({ userStatus: 'PENDING_VERIFICATION' }),
      rawSessionToken: RAW_TOKEN,
    });
    cases.push({
      fixture: createFixture({ membershipPresent: false }),
      rawSessionToken: RAW_TOKEN,
    });

    for (const testCase of cases) {
      await expect(
        testCase.fixture.useCase.execute({
          rawSessionToken: testCase.rawSessionToken,
          currentPassword: CURRENT_PASSWORD,
          newPassword: NEW_PASSWORD,
        }),
      ).rejects.toBeInstanceOf(AuthenticationRequiredError);
      expect(testCase.fixture.hasher.received).toHaveLength(0);
      expect(testCase.fixture.credentials.replacements).toHaveLength(0);
      expect(testCase.fixture.resetTokens.invalidations).toHaveLength(0);
      expect(testCase.fixture.audits).toHaveLength(0);
      expect(testCase.fixture.cache.stored).toHaveLength(0);
    }
  });

  it('rejects unchanged and compromised replacements before hashing or persistence', async () => {
    const unchanged = createFixture();
    await expect(
      unchanged.useCase.execute({
        rawSessionToken: RAW_TOKEN,
        currentPassword: CURRENT_PASSWORD,
        newPassword: CURRENT_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(InvalidPasswordChangePasswordError);
    expect(unchanged.hasher.received).toHaveLength(0);

    const compromised = createFixture({ compromised: true });
    await expect(
      compromised.useCase.execute({
        rawSessionToken: RAW_TOKEN,
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(InvalidPasswordChangePasswordError);
    expect(compromised.hasher.received).toHaveLength(0);
    expect(compromised.credentials.replacements).toHaveLength(0);
  });

  it('keeps a committed rotation successful when Redis maintenance fails', async () => {
    const fixture = createFixture();
    fixture.cache.fail = true;

    await expect(
      fixture.useCase.execute({
        rawSessionToken: RAW_TOKEN,
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
      }),
    ).resolves.toEqual(
      expect.objectContaining({ sessionExpiresAt: EXPIRES_AT }),
    );
    expect(
      fixture.sessions.sessions.filter((session) => !session.revokedAt),
    ).toHaveLength(1);
  });
});

function createFixture(options?: {
  currentPasswordMatches?: boolean;
  compromised?: boolean;
  userStatus?: 'PENDING_VERIFICATION' | 'ACTIVE';
  membershipPresent?: boolean;
}): {
  useCase: ChangePassword;
  sessions: RecordingSessionsRepository;
  credentials: RecordingCredentialRepository;
  resetTokens: RecordingResetTokensRepository;
  audits: AppendAuditLog[];
  cache: RecordingSessionCache;
  hasher: PasswordHasher & { received: string[] };
} {
  const sessionTokens = new SessionTokenService();
  const sessionsRepository = new RecordingSessionsRepository(
    sessionTokens.hash(RAW_TOKEN),
  );
  const sessions = new AuthenticationSessions(sessionsRepository);
  const users = new Users({
    create: () => Promise.resolve(),
    findById: () => Promise.resolve(null),
    findAuthenticationReferenceById: () =>
      Promise.resolve({
        id: 'user-1',
        identityId: 'identity-1',
        status: options?.userStatus ?? 'ACTIVE',
      }),
    findByIdentityId: () => Promise.resolve(null),
    findActiveByIdentityId: () => Promise.resolve(null),
    activate: () => Promise.resolve(false),
  });
  const memberships = new Memberships({
    createOwner: () => Promise.resolve(),
    find: (input) =>
      Promise.resolve(
        options?.membershipPresent === false
          ? null
          : { ...input, role: 'OWNER' },
      ),
    resolveLoginWorkspace: () => Promise.resolve({ kind: 'none' }),
  });
  const credentialsRepository = new RecordingCredentialRepository();
  const verifier: PasswordVerifier = {
    matches: (password) =>
      Promise.resolve(
        (options?.currentPasswordMatches ?? true) &&
          password === CURRENT_PASSWORD,
      ),
  };
  const credentialVerification = new PasswordCredentialVerification(
    credentialsRepository,
    verifier,
  );
  const resetTokensRepository = new RecordingResetTokensRepository();
  const resetTokens = new PasswordResetTokens(resetTokensRepository);
  const audits: AppendAuditLog[] = [];
  const auditLog = new AuditLog({
    append(input) {
      audits.push(input);
      return Promise.resolve();
    },
  });
  const compromiseChecker: PasswordCompromiseChecker = {
    isCompromised: () => Promise.resolve(options?.compromised ?? false),
  };
  const receivedPasswords: string[] = [];
  const hasher: PasswordHasher & { received: string[] } = {
    received: receivedPasswords,
    hash(password) {
      receivedPasswords.push(password);
      return Promise.resolve('stored-new-hash');
    },
  };
  const cache = new RecordingSessionCache();
  const clock = new Clock();
  jest.spyOn(clock, 'now').mockReturnValue(NOW);

  return {
    sessions: sessionsRepository,
    credentials: credentialsRepository,
    resetTokens: resetTokensRepository,
    audits,
    cache,
    hasher,
    useCase: new ChangePassword(
      sessions,
      users,
      memberships,
      credentialVerification,
      resetTokens,
      auditLog,
      new PasswordPolicy(),
      compromiseChecker,
      hasher,
      new InlineTransactionManager(),
      cache,
      sessionTokens,
      new IdentifierFactory(),
      clock,
    ),
  };
}
