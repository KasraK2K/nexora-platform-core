import { AuditLog } from '../../audit/application/audit-log';
import { AppConfig } from '../../configuration/app-config';
import {
  IdentityRegistration,
  type CreatePasswordIdentity,
} from '../../identity/application/identity-registration';
import { Memberships } from '../../memberships/application/memberships';
import { Organizations } from '../../organizations/application/organizations';
import { Users } from '../../users/application/users';
import { Workspaces } from '../../workspaces/application/workspaces';
import { Clock } from '../../../shared/application/clock';
import { IdentifierFactory } from '../../../shared/application/identifier-factory';
import type { TransactionManager } from '../../../shared/application/transaction-manager.port';
import { PasswordPolicy } from '../domain/password-policy';
import {
  InvalidRegistrationError,
  RegistrationUnavailableError,
} from '../domain/registration.errors';
import { AuthenticationSessions } from './authentication-sessions';
import type { PasswordCompromiseChecker } from './password-compromise-checker.port';
import type { PasswordHasher } from './password-hasher.port';
import { RegisterAccount } from './register-account.use-case';
import type { SessionCachePort } from './session-cache.port';
import { SessionTokenService } from './session-token.service';
import type { EmailVerificationSender } from './email-verification-sender.port';
import { EmailVerificationDelivery } from './email-verification-delivery';
import { EmailVerificationTokenService } from './email-verification-token.service';
import {
  EmailVerifications,
  type EmailVerificationsRepository,
} from './email-verifications';

class RecordingHasher implements PasswordHasher {
  received: string[] = [];

  hash(password: string): Promise<string> {
    this.received.push(password);
    return Promise.resolve('argon2id-hash');
  }
}

class RecordingPasswordCompromiseChecker implements PasswordCompromiseChecker {
  received: string[] = [];
  compromised = false;
  failure: Error | undefined;

  isCompromised(password: string): Promise<boolean> {
    this.received.push(password);
    return this.failure
      ? Promise.reject(this.failure)
      : Promise.resolve(this.compromised);
  }
}

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

class RecordingEmailSender implements EmailVerificationSender {
  deliveries: Array<{ to: string; token: string; expiresAt: Date }> = [];
  failure: Error | undefined;

  send(input: { to: string; token: string; expiresAt: Date }): Promise<void> {
    this.deliveries.push(input);
    return this.failure ? Promise.reject(this.failure) : Promise.resolve();
  }
}

class RecordingEmailVerifications implements EmailVerificationsRepository {
  writes: Array<{
    id: string;
    userId: string;
    workspaceId: string;
    tokenHash: string;
    expiresAt: Date;
  }> = [];

  create(input: (typeof this.writes)[number]): Promise<void> {
    this.writes.push(input);
    return Promise.resolve();
  }
  invalidateOpenForUser(): Promise<void> {
    return Promise.resolve();
  }
  findUsableByTokenHash(): Promise<null> {
    return Promise.resolve(null);
  }
  findLatestForUser(): Promise<null> {
    return Promise.resolve(null);
  }
  consume(): Promise<boolean> {
    return Promise.resolve(false);
  }
  markDelivery(): Promise<void> {
    return Promise.resolve();
  }
}

describe('RegisterAccount', () => {
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

  it('normalizes identity data and passes only a password hash to its owner', async () => {
    const fixture = createFixture();

    const result = await fixture.useCase.execute({
      email: '  PERSON@Example.COM ',
      password: 'A secure passphrase 123',
      displayName: 'Person',
      organizationName: 'Example Org',
      workspaceName: 'Main Workspace',
    });

    expect(fixture.hasher.received).toEqual(['A secure passphrase 123']);
    expect(fixture.passwordCompromiseChecker.received).toEqual([
      'A secure passphrase 123',
    ]);
    expect(fixture.identityWrites).toEqual([
      expect.objectContaining({
        normalizedEmail: 'person@example.com',
        passwordHash: 'argon2id-hash',
      }),
    ]);
    expect(fixture.identityWrites[0]).not.toHaveProperty('password');
    expect(fixture.sessionCache.stores).toHaveLength(1);
    expect(fixture.emailVerifications.writes).toHaveLength(1);
    expect(fixture.emailVerifications.writes[0].tokenHash).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(fixture.emailSender.deliveries).toEqual([
      expect.objectContaining({ to: 'person@example.com' }),
    ]);
    expect(result.status).toBe('PENDING_VERIFICATION');
    expect(result.sessionExpiresAt).toEqual(
      new Date('2026-07-21T01:00:00.000Z'),
    );
  });

  it('rejects a short password before hashing or persistence', async () => {
    const fixture = createFixture();

    await expect(
      fixture.useCase.execute({
        email: 'person@example.com',
        password: 'too short',
        displayName: 'Person',
        organizationName: 'Example Org',
        workspaceName: 'Main Workspace',
      }),
    ).rejects.toBeInstanceOf(InvalidRegistrationError);
    expect(fixture.hasher.received).toHaveLength(0);
    expect(fixture.identityWrites).toHaveLength(0);
  });

  it('rejects a compromised password before hashing or persistence', async () => {
    const fixture = createFixture();
    fixture.passwordCompromiseChecker.compromised = true;

    await expect(
      fixture.useCase.execute({
        email: 'person@example.com',
        password: 'A breached passphrase 123',
        displayName: 'Person',
        organizationName: 'Example Org',
        workspaceName: 'Main Workspace',
      }),
    ).rejects.toBeInstanceOf(InvalidRegistrationError);
    expect(fixture.hasher.received).toHaveLength(0);
    expect(fixture.identityWrites).toHaveLength(0);
  });

  it('fails safely when the checker itself cannot produce a fallback result', async () => {
    const fixture = createFixture();
    fixture.passwordCompromiseChecker.failure = new Error('checker failed');

    await expect(
      fixture.useCase.execute({
        email: 'person@example.com',
        password: 'A secure passphrase 123',
        displayName: 'Person',
        organizationName: 'Example Org',
        workspaceName: 'Main Workspace',
      }),
    ).rejects.toBeInstanceOf(RegistrationUnavailableError);
    expect(fixture.hasher.received).toHaveLength(0);
    expect(fixture.identityWrites).toHaveLength(0);
  });

  it('keeps the committed account pending when delivery fails', async () => {
    const fixture = createFixture();
    fixture.emailSender.failure = new Error('smtp unavailable');

    const result = await fixture.useCase.execute({
      email: 'person@example.com',
      password: 'A secure passphrase 123',
      displayName: 'Person',
      organizationName: 'Example Org',
      workspaceName: 'Main Workspace',
    });

    expect(result.verificationEmailSent).toBe(false);
    expect(result.status).toBe('PENDING_VERIFICATION');
    expect(fixture.emailVerifications.writes).toHaveLength(1);
  });
});

function createFixture(): {
  useCase: RegisterAccount;
  hasher: RecordingHasher;
  passwordCompromiseChecker: RecordingPasswordCompromiseChecker;
  identityWrites: CreatePasswordIdentity[];
  sessionCache: RecordingSessionCache;
  emailVerifications: RecordingEmailVerifications;
  emailSender: RecordingEmailSender;
} {
  const identityWrites: CreatePasswordIdentity[] = [];
  const hasher = new RecordingHasher();
  const passwordCompromiseChecker = new RecordingPasswordCompromiseChecker();
  const sessionCache = new RecordingSessionCache();
  const emailVerificationRepository = new RecordingEmailVerifications();
  const emailVerifications = new EmailVerifications(
    emailVerificationRepository,
  );
  const emailSender = new RecordingEmailSender();
  const clock = new Clock();
  jest
    .spyOn(clock, 'now')
    .mockReturnValue(new Date('2026-07-21T00:00:00.000Z'));

  const identities = new IdentityRegistration({
    createPasswordIdentity(input) {
      identityWrites.push(input);
      return Promise.resolve();
    },
  });
  const users = new Users({
    create: () => Promise.resolve(),
    findById: () => Promise.resolve(null),
    findAuthenticationReferenceById: () => Promise.resolve(null),
    findByIdentityId: () => Promise.resolve(null),
    findActiveByIdentityId: () => Promise.resolve(null),
    activate: () => Promise.resolve(false),
  });
  const organizations = new Organizations({
    create: () => Promise.resolve(),
    findById: () => Promise.resolve(null),
  });
  const workspaces = new Workspaces({
    create: () => Promise.resolve(),
    findById: () => Promise.resolve(null),
  });
  const memberships = new Memberships({
    createOwner: () => Promise.resolve(),
    find: () => Promise.resolve(null),
    resolveLoginWorkspace: () => Promise.resolve({ kind: 'none' }),
  });
  const sessions = new AuthenticationSessions({
    create: () => Promise.resolve(),
    findByTokenHash: () => Promise.resolve(null),
    findLatestForUser: () => Promise.resolve(null),
    revokeByTokenHash: () => Promise.resolve(null),
    revokeAllForUser: () => Promise.resolve([]),
  });
  const auditLog = new AuditLog({ append: () => Promise.resolve() });

  return {
    hasher,
    passwordCompromiseChecker,
    identityWrites,
    sessionCache,
    emailVerifications: emailVerificationRepository,
    emailSender,
    useCase: new RegisterAccount(
      hasher,
      passwordCompromiseChecker,
      new InlineTransactionManager(),
      identities,
      users,
      organizations,
      workspaces,
      memberships,
      sessions,
      auditLog,
      sessionCache,
      new PasswordPolicy(),
      new SessionTokenService(),
      new EmailVerificationTokenService(),
      emailVerifications,
      new EmailVerificationDelivery(emailSender, emailVerifications, clock),
      new IdentifierFactory(),
      clock,
      new AppConfig(),
    ),
  };
}
