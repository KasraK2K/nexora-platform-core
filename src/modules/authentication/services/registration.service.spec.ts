import { AuditService } from '../../audit/audit.service';
import { AppConfig } from '../../../config/app-config';
import {
  IdentityService,
  type CreatePasswordIdentity,
} from '../../identity/identity.service';
import { MembershipsService } from '../../memberships/memberships.service';
import { OrganizationsService } from '../../organizations/organizations.service';
import { UsersService } from '../../users/users.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { Clock } from '../../../common/clock';
import { IdentifierFactory } from '../../../common/identifier-factory';
import type { TransactionManager } from '../../../common/transaction-manager';
import { PasswordPolicy } from '../security/password-policy';
import {
  InvalidRegistrationError,
  RegistrationUnavailableError,
} from '../errors/authentication.errors';
import type { PasswordCompromiseChecker } from '../security/password-compromise-checker';
import type { PasswordHasher } from '../security/password-hasher';
import type { SessionCachePort } from '../cache/session-cache';
import { OpaqueTokenService } from '../../../common/security/opaque-token.service';
import { EmailVerificationDeliveryService } from '../mail/email-verification-delivery.service';
import { RegistrationService } from './registration.service';

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

class RecordingEmailSender {
  deliveries: Array<{ to: string; token: string; expiresAt: Date }> = [];
  failure: Error | undefined;

  send(input: { to: string; token: string; expiresAt: Date }): Promise<void> {
    this.deliveries.push(input);
    return this.failure ? Promise.reject(this.failure) : Promise.resolve();
  }
}

class RecordingEmailVerifications {
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

describe('RegistrationService.register', () => {
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

    const result = await fixture.service.register({
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
      fixture.service.register({
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
      fixture.service.register({
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
      fixture.service.register({
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
    fixture.emailSender.failure = new Error('mail provider unavailable');

    const result = await fixture.service.register({
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
  service: RegistrationService;
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
  const emailSender = new RecordingEmailSender();
  const clock = new Clock();
  jest
    .spyOn(clock, 'now')
    .mockReturnValue(new Date('2026-07-21T00:00:00.000Z'));

  const identities: Pick<IdentityService, 'createPasswordIdentity'> = {
    createPasswordIdentity(input) {
      identityWrites.push(input);
      return Promise.resolve();
    },
  };
  const users: Pick<UsersService, 'create'> = {
    create: () => Promise.resolve(),
  };
  const organizations = new OrganizationsService({
    create: () => Promise.resolve(),
    findById: () => Promise.resolve(null),
    findByIds: () => Promise.resolve([]),
  } as never);
  const workspaces: Pick<WorkspacesService, 'create'> = {
    create: () => Promise.resolve(),
  };
  const memberships: Pick<MembershipsService, 'createOwner'> = {
    createOwner: () => Promise.resolve(),
  };
  const sessions = {
    create: () => Promise.resolve(),
    findByTokenHash: () => Promise.resolve(null),
    findLatestForUser: () => Promise.resolve(null),
    revokeByTokenHash: () => Promise.resolve(null),
    revokeAllForUser: () => Promise.resolve([]),
    storeCacheBestEffort: (tokenHash: string) => sessionCache.store(tokenHash),
  };
  const auditLog = new AuditService({
    append: () => Promise.resolve(),
  } as never);
  const config = new AppConfig();
  let queuedMail: { to: string; text: string; expiresAt: Date } | undefined;
  const outbox = {
    enqueue(input: { to: string; text: string; expiresAt: Date }) {
      queuedMail = input;
      return Promise.resolve();
    },
    async deliverNow(): Promise<boolean> {
      if (!queuedMail) return false;
      const match = queuedMail.text.match(/#token=([^\s]+)/);
      if (!match) return false;
      try {
        await emailSender.send({
          to: queuedMail.to,
          token: decodeURIComponent(match[1]),
          expiresAt: queuedMail.expiresAt,
        });
        return true;
      } catch {
        return false;
      }
    },
  };

  return {
    hasher,
    passwordCompromiseChecker,
    identityWrites,
    sessionCache,
    emailVerifications: emailVerificationRepository,
    emailSender,
    service: new RegistrationService(
      hasher,
      passwordCompromiseChecker,
      new InlineTransactionManager(),
      identities as never,
      users as never,
      organizations,
      workspaces as never,
      memberships as never,
      sessions as never,
      auditLog,
      emailVerificationRepository as never,
      new PasswordPolicy(),
      new OpaqueTokenService(),
      new EmailVerificationDeliveryService(
        outbox as never,
        emailVerificationRepository as never,
        clock,
        config,
      ),
      new IdentifierFactory(),
      clock,
      config,
    ),
  };
}
