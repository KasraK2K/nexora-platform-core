import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { verify } from 'argon2';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/core/persistence/prisma.service';
import { RedisService } from '../src/core/redis/redis.service';
import { SessionCache } from '../src/core/authentication/infrastructure/session-cache';
import { AuditLog } from '../src/core/audit/application/audit-log';
import { PASSWORD_HASHER } from '../src/core/authentication/application/password-hasher.port';
import type { PasswordHasher } from '../src/core/authentication/application/password-hasher.port';

const ALLOWED_ORIGIN = 'http://localhost:3000';

describe('Nexora API (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let sessionCache: SessionCache;
  let auditLog: AuditLog;
  let passwordHasher: PasswordHasher;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    sessionCache = app.get(SessionCache);
    auditLog = app.get(AuditLog);
    passwordHasher = app.get<PasswordHasher>(PASSWORD_HASHER);
  });

  beforeEach(async () => {
    await clearRegistrationData(prisma);
    await redis.client.flushDb();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('preserves the starter health response', async () => {
    await request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('registers one complete account graph and resolves its trusted workspace', async () => {
    const registration = await register('Owner@Example.com');

    expect(registration.status).toBe(201);
    expect(registration.headers['cache-control']).toBe('no-store');
    expect(registration.body).toMatchObject({
      data: {
        user: { displayName: 'Owner' },
        organization: { name: 'Nexora Customer' },
        workspace: { name: 'Main Workspace' },
        membership: { role: 'OWNER' },
      },
      meta: {},
    });
    expect(JSON.stringify(registration.body)).not.toContain(
      'A secure passphrase 123',
    );
    expect(JSON.stringify(registration.body)).not.toContain('argon2');

    const setCookie = registration.headers['set-cookie'] as unknown as string[];
    expect(setCookie).toHaveLength(1);
    expect(setCookie[0]).toContain('__Host-nexora_session=');
    expect(setCookie[0]).toContain('HttpOnly');
    expect(setCookie[0]).toContain('Secure');
    expect(setCookie[0]).toContain('SameSite=Lax');
    expect(setCookie[0]).toContain('Path=/');
    expect(setCookie[0]).not.toContain('Domain=');

    const [
      identity,
      credential,
      user,
      organization,
      workspace,
      membership,
      session,
      audit,
    ] = await Promise.all([
      prisma.identity.findFirstOrThrow(),
      prisma.passwordCredential.findFirstOrThrow(),
      prisma.user.findFirstOrThrow(),
      prisma.organization.findFirstOrThrow(),
      prisma.workspace.findFirstOrThrow(),
      prisma.membership.findFirstOrThrow(),
      prisma.session.findFirstOrThrow(),
      prisma.auditLog.findFirstOrThrow(),
    ]);

    expect(identity.normalizedEmail).toBe('owner@example.com');
    expect(credential.passwordHash).not.toBe('A secure passphrase 123');
    await expect(
      verify(credential.passwordHash, 'A secure passphrase 123'),
    ).resolves.toBe(true);
    expect(user.identityId).toBe(identity.id);
    expect(organization.ownerUserId).toBe(user.id);
    expect(workspace.organizationId).toBe(organization.id);
    expect(membership).toMatchObject({
      userId: user.id,
      workspaceId: workspace.id,
      role: 'OWNER',
    });
    expect(session).toMatchObject({
      userId: user.id,
      activeWorkspaceId: workspace.id,
    });
    expect(session.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(audit).toMatchObject({
      workspaceId: workspace.id,
      actorUserId: user.id,
      action: 'account.registered',
    });

    const cookie = setCookie[0].split(';', 1)[0];
    expect(cookie).not.toContain(session.tokenHash);
    const rawToken = cookie.slice(cookie.indexOf('=') + 1);
    const sessionKeys = await redis.client.keys('auth:session:*');
    expect(sessionKeys).toEqual([`auth:session:${session.tokenHash}`]);
    expect(sessionKeys[0]).not.toContain(rawToken);
    const current = await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', cookie)
      .expect(200);
    expect(current.headers['cache-control']).toBe('no-store');
    expect(readString(current.body as unknown, 'data', 'workspace', 'id')).toBe(
      workspace.id,
    );
    expect(readString(current.body as unknown, 'data', 'user', 'id')).toBe(
      user.id,
    );
  });

  it('rejects equivalent duplicate emails and remains race-safe', async () => {
    const [first, second] = await Promise.all([
      register('race@example.com'),
      register('  RACE@EXAMPLE.COM  '),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 409]);
    expect(await prisma.identity.count()).toBe(1);
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.organization.count()).toBe(1);
    expect(await prisma.workspace.count()).toBe(1);
    expect(await prisma.membership.count()).toBe(1);
  });

  it('rejects untrusted fields and disallowed origins before creating data', async () => {
    const privileged = await request(app.getHttpServer())
      .post('/v1/auth/registrations')
      .set('Origin', ALLOWED_ORIGIN)
      .send({
        ...registrationBody('fields@example.com'),
        role: 'ADMIN',
        workspaceId: 'attacker',
      });
    expect(privileged.status).toBe(400);
    expect(readString(privileged.body as unknown, 'error', 'code')).toBe(
      'VALIDATION_FAILED',
    );

    const crossOrigin = await request(app.getHttpServer())
      .post('/v1/auth/registrations')
      .set('Origin', 'https://attacker.example')
      .send(registrationBody('origin@example.com'));
    expect(crossOrigin.status).toBe(403);
    expect(readString(crossOrigin.body as unknown, 'error', 'code')).toBe(
      'ORIGIN_NOT_ALLOWED',
    );

    const missingOrigin = await request(app.getHttpServer())
      .post('/v1/auth/registrations')
      .send(registrationBody('missing-origin@example.com'));
    expect(missingOrigin.status).toBe(403);
    expect(readString(missingOrigin.body as unknown, 'error', 'code')).toBe(
      'ORIGIN_NOT_ALLOWED',
    );
    expect(await prisma.identity.count()).toBe(0);
  });

  it('rate-limits repeated registration attempts before password hashing', async () => {
    const hash = jest
      .spyOn(passwordHasher, 'hash')
      .mockResolvedValue('$argon2id$test-hash');
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/registrations')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-Forwarded-For', '203.0.113.10')
        .send({
          ...registrationBody(`limited-${attempt}@example.com`),
          password: 'A secure passphrase 123',
        });
      expect(response.status).toBe(201);
    }

    const limited = await request(app.getHttpServer())
      .post('/v1/auth/registrations')
      .set('Origin', ALLOWED_ORIGIN)
      .set('X-Forwarded-For', '203.0.113.10')
      .send({
        ...registrationBody('limited-final@example.com'),
        password: 'A secure passphrase 123',
      });
    expect(limited.status).toBe(429);
    expect(readString(limited.body as unknown, 'error', 'code')).toBe(
      'REGISTRATION_RATE_LIMITED',
    );
    expect(limited.headers['retry-after']).toBeDefined();
    expect(hash).toHaveBeenCalledTimes(10);

    const independentClient = await request(app.getHttpServer())
      .post('/v1/auth/registrations')
      .set('Origin', ALLOWED_ORIGIN)
      .set('X-Forwarded-For', '203.0.113.11')
      .send(registrationBody('independent@example.com'));
    expect(independentClient.status).toBe(201);
    expect(hash).toHaveBeenCalledTimes(11);
  });

  it('does not allow one session to resolve another workspace', async () => {
    const accountA = await register('tenant-a@example.com');
    const cookieA = (
      accountA.headers['set-cookie'] as unknown as string[]
    )[0].split(';', 1)[0];
    const workspaceA = readString(
      accountA.body as unknown,
      'data',
      'workspace',
      'id',
    );

    const accountB = await register('tenant-b@example.com');
    const workspaceB = readString(
      accountB.body as unknown,
      'data',
      'workspace',
      'id',
    );

    const current = await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', cookieA)
      .expect(200);
    expect(readString(current.body as unknown, 'data', 'workspace', 'id')).toBe(
      workspaceA,
    );
    expect(
      readString(current.body as unknown, 'data', 'workspace', 'id'),
    ).not.toBe(workspaceB);
  });

  it('enforces the session-to-membership tenant invariant in PostgreSQL', async () => {
    const accountA = await register('constraint-a@example.com');
    const accountB = await register('constraint-b@example.com');
    const userA = readString(accountA.body as unknown, 'data', 'user', 'id');
    const workspaceB = readString(
      accountB.body as unknown,
      'data',
      'workspace',
      'id',
    );

    await expect(
      prisma.session.create({
        data: {
          id: randomUUID(),
          tokenHash: 'a'.repeat(64),
          userId: userA,
          activeWorkspaceId: workspaceB,
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
    ).rejects.toBeDefined();
  });

  it('rolls back every durable record when a module participant fails', async () => {
    jest
      .spyOn(auditLog, 'append')
      .mockRejectedValueOnce(new Error('audit unavailable'));

    const response = await register('rollback@example.com');
    expect(response.status).toBe(503);
    expect(readString(response.body as unknown, 'error', 'code')).toBe(
      'REGISTRATION_UNAVAILABLE',
    );
    expect(await prisma.identity.count()).toBe(0);
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.organization.count()).toBe(0);
    expect(await prisma.workspace.count()).toBe(0);
    expect(await prisma.membership.count()).toBe(0);
    expect(await prisma.session.count()).toBe(0);
  });

  it('keeps a committed registration usable when the Redis session cache misses', async () => {
    jest
      .spyOn(sessionCache, 'store')
      .mockRejectedValueOnce(new Error('redis cache unavailable'));

    const response = await register('cache-miss@example.com');
    expect(response.status).toBe(201);
    expect(await prisma.identity.count()).toBe(1);
    expect(await prisma.session.count()).toBe(1);

    const cookie = (
      response.headers['set-cookie'] as unknown as string[]
    )[0].split(';', 1)[0];
    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', cookie)
      .expect(200);
  });

  it('resolves an authoritative PostgreSQL session during a Redis cache outage', async () => {
    const response = await register('session-cache-outage@example.com');
    const cookie = (
      response.headers['set-cookie'] as unknown as string[]
    )[0].split(';', 1)[0];
    jest
      .spyOn(sessionCache, 'exists')
      .mockRejectedValueOnce(new Error('redis cache unavailable'));

    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', cookie)
      .expect(200);
  });

  it('replaces an attacker-supplied session cookie during registration', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/registrations')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', '__Host-nexora_session=attacker-controlled')
      .send(registrationBody('rotation@example.com'));

    expect(response.status).toBe(201);
    const setCookie = response.headers['set-cookie'] as unknown as string[];
    expect(setCookie[0]).not.toContain('attacker-controlled');
  });

  afterAll(async () => {
    await app.close();
  });

  function register(email: string) {
    return request(app.getHttpServer())
      .post('/v1/auth/registrations')
      .set('Origin', ALLOWED_ORIGIN)
      .send(registrationBody(email));
  }
});

function registrationBody(email: string) {
  return {
    email,
    password: 'A secure passphrase 123',
    displayName: 'Owner',
    organizationName: 'Nexora Customer',
    workspaceName: 'Main Workspace',
  };
}

async function clearRegistrationData(prisma: PrismaService): Promise<void> {
  await prisma.auditLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
  await prisma.passwordCredential.deleteMany();
  await prisma.identity.deleteMany();
}

function readString(value: unknown, ...path: string[]): string {
  let current = value;

  for (const key of path) {
    if (typeof current !== 'object' || current === null || !(key in current)) {
      throw new Error(`Expected response path: ${path.join('.')}`);
    }
    current = current[key as keyof typeof current];
  }

  if (typeof current !== 'string') {
    throw new Error(`Expected string response path: ${path.join('.')}`);
  }

  return current;
}
