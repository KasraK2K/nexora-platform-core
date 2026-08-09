import { Test, TestingModule } from '@nestjs/testing';
import { Controller, Get } from '@nestjs/common';
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
import { PasswordIdentityAuthentication } from '../src/core/identity/application/password-identity-authentication';
import { PasswordCredentialVerification } from '../src/core/identity/application/password-credential-verification';
import { AuthenticationRateLimiter } from '../src/core/authentication/infrastructure/authentication-rate-limiter';
import { SessionTokenService } from '../src/core/authentication/application/session-token.service';
import {
  EMAIL_VERIFICATION_SENDER,
  type EmailVerificationSender,
} from '../src/core/authentication/application/email-verification-sender.port';
import {
  PASSWORD_RESET_SENDER,
  type PasswordResetSender,
} from '../src/core/authentication/application/password-reset-sender.port';
import { AuthenticatedRoute } from '../src/core/authorization/presentation/route-admission';
import { CurrentAuthenticatedContext } from '../src/core/authentication/presentation/authenticated-request-context';
import type { AuthenticatedRequestContext } from '../src/core/authentication/application/authenticated-request-context';

const ALLOWED_ORIGIN = 'http://localhost:3000';
const verificationDeliveries: Array<{
  to: string;
  token: string;
  expiresAt: Date;
}> = [];
const recordingEmailSender: EmailVerificationSender = {
  send(input) {
    verificationDeliveries.push(input);
    return Promise.resolve();
  },
};
const resetDeliveries: Array<{
  to: string;
  token: string;
  expiresAt: Date;
}> = [];
const recordingPasswordResetSender: PasswordResetSender = {
  send(input) {
    resetDeliveries.push(input);
    return Promise.resolve();
  },
};
let unclassifiedRouteExecutions = 0;

@Controller('__test/route-admission')
class RouteAdmissionProbeController {
  @Get('unclassified')
  unclassified(): string {
    unclassifiedRouteExecutions += 1;
    return 'must not execute';
  }

  @Get('active')
  @AuthenticatedRoute()
  active(
    @CurrentAuthenticatedContext() context: AuthenticatedRequestContext,
  ): AuthenticatedRequestContext {
    return context;
  }

  @Get('pending')
  @AuthenticatedRoute({ allowPendingVerification: true })
  pending(
    @CurrentAuthenticatedContext() context: AuthenticatedRequestContext,
  ): AuthenticatedRequestContext {
    return context;
  }
}

describe('Nexora API (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let sessionCache: SessionCache;
  let auditLog: AuditLog;
  let passwordHasher: PasswordHasher;
  let passwordIdentities: PasswordIdentityAuthentication;
  let passwordCredentialVerification: PasswordCredentialVerification;
  let authenticationRateLimiter: AuthenticationRateLimiter;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [RouteAdmissionProbeController],
    })
      .overrideProvider(EMAIL_VERIFICATION_SENDER)
      .useValue(recordingEmailSender)
      .overrideProvider(PASSWORD_RESET_SENDER)
      .useValue(recordingPasswordResetSender)
      .compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    sessionCache = app.get(SessionCache);
    auditLog = app.get(AuditLog);
    passwordHasher = app.get<PasswordHasher>(PASSWORD_HASHER);
    passwordIdentities = app.get(PasswordIdentityAuthentication);
    passwordCredentialVerification = app.get(PasswordCredentialVerification);
    authenticationRateLimiter = app.get(AuthenticationRateLimiter);
  });

  beforeEach(async () => {
    await clearRegistrationData(prisma);
    await redis.client.flushDb();
    verificationDeliveries.length = 0;
    resetDeliveries.length = 0;
    unclassifiedRouteExecutions = 0;
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

  it('keeps the adapter-mounted OpenAPI UI public in development', async () => {
    await request(app.getHttpServer()).get('/docs/').expect(200);
  });

  it('denies unclassified routes by default without exposing internals', async () => {
    const response = await request(app.getHttpServer()).get(
      '/__test/route-admission/unclassified',
    );

    expect(response.status).toBe(403);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({
      error: {
        code: 'ROUTE_ACCESS_DENIED',
        message: 'Access to this route is denied.',
        retryable: false,
      },
    });
    expect(unclassifiedRouteExecutions).toBe(0);
  });

  it('requires active status by default and permits pending users only by explicit policy', async () => {
    const email = 'route-admission@example.com';
    const registration = await registerUnverified(email);
    const cookie = readCookieHeader(registration);

    const pendingAllowed = await request(app.getHttpServer())
      .get('/__test/route-admission/pending')
      .set('Cookie', cookie)
      .expect(200);
    expect(pendingAllowed.body).toMatchObject({
      actorUserId: readString(
        registration.body as unknown,
        'data',
        'user',
        'id',
      ),
      userStatus: 'PENDING_VERIFICATION',
      workspaceId: readString(
        registration.body as unknown,
        'data',
        'workspace',
        'id',
      ),
    });

    const activeOnly = await request(app.getHttpServer())
      .get('/__test/route-admission/active')
      .set('Cookie', cookie)
      .set('X-User-Status', 'ACTIVE');
    expect(activeOnly.status).toBe(403);
    expect(activeOnly.headers['cache-control']).toBe('no-store');
    expect(readString(activeOnly.body as unknown, 'error', 'code')).toBe(
      'EMAIL_VERIFICATION_REQUIRED',
    );

    await confirmEmail(await readVerificationToken(email)).expect(204);
    const active = await request(app.getHttpServer())
      .get('/__test/route-admission/active')
      .set('Cookie', cookie)
      .expect(200);
    expect(active.body).toMatchObject({ userStatus: 'ACTIVE' });
  });

  it('requires a valid opaque session for every authenticated route', async () => {
    const response = await request(app.getHttpServer()).get(
      '/__test/route-admission/active',
    );

    expect(response.status).toBe(401);
    expect(readString(response.body as unknown, 'error', 'code')).toBe(
      'AUTHENTICATION_REQUIRED',
    );
    expect(response.headers['cache-control']).toBe('no-store');
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

  it('requires email verification before login and rejects token replay', async () => {
    const registration = await registerUnverified('verify-me@example.com');

    expect(registration.status).toBe(201);
    expect(registration.body).toMatchObject({
      data: {
        user: { status: 'PENDING_VERIFICATION' },
      },
      meta: {
        verificationRequired: true,
        verificationEmailSent: true,
      },
    });
    await login('verify-me@example.com').then((response) =>
      expect(response.status).toBe(401),
    );

    const token = await readVerificationToken('verify-me@example.com');
    const stored = await prisma.emailVerification.findFirstOrThrow();
    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.tokenHash).not.toBe(token);

    await confirmEmail(token).expect(204);
    expect((await prisma.user.findFirstOrThrow()).status).toBe('ACTIVE');
    expect(
      (await prisma.emailVerification.findFirstOrThrow()).consumedAt,
    ).not.toBeNull();
    await confirmEmail(token).expect(400);
    await login('verify-me@example.com').then((response) =>
      expect(response.status).toBe(201),
    );
  });

  it('returns a generic resend response and replaces earlier links', async () => {
    await registerUnverified('resend@example.com');
    const firstToken = await readVerificationToken('resend@example.com');

    const missing = await request(app.getHttpServer())
      .post('/v1/auth/email-verification-requests')
      .set('Origin', ALLOWED_ORIGIN)
      .send({ email: 'missing@example.com' });
    const existing = await request(app.getHttpServer())
      .post('/v1/auth/email-verification-requests')
      .set('Origin', ALLOWED_ORIGIN)
      .send({ email: ' RESEND@Example.com ' });

    expect(missing.status).toBe(202);
    expect(existing.status).toBe(202);
    expect(existing.body).toEqual(missing.body);
    const secondToken = await readVerificationToken(
      'resend@example.com',
      firstToken,
    );
    expect(secondToken).not.toBe(firstToken);
    await confirmEmail(firstToken).expect(400);
    await confirmEmail(secondToken).expect(204);
    expect(
      await prisma.emailVerification.count({
        where: { invalidatedAt: { not: null } },
      }),
    ).toBe(1);
  });

  it('rejects an expired verification link without activating the user', async () => {
    await registerUnverified('expired@example.com');
    const token = await readVerificationToken('expired@example.com');
    await prisma.emailVerification.updateMany({
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    await confirmEmail(token).expect(400);
    expect((await prisma.user.findFirstOrThrow()).status).toBe(
      'PENDING_VERIFICATION',
    );
  });

  it('commits registration and records a failed delivery attempt', async () => {
    jest
      .spyOn(recordingEmailSender, 'send')
      .mockRejectedValueOnce(new Error('smtp unavailable'));

    const response = await registerUnverified('delivery-failed@example.com');

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      data: { user: { status: 'PENDING_VERIFICATION' } },
      meta: { verificationEmailSent: false },
    });
    expect(
      (await prisma.emailVerification.findFirstOrThrow()).deliveryStatus,
    ).toBe('FAILED');
  });

  it('resets a password, revokes every session, and accepts only the replacement password', async () => {
    const registration = await register('password-reset@example.com');
    const registrationCookie = readCookieHeader(registration);
    const secondSession = await login('password-reset@example.com');
    const secondCookie = readCookieHeader(secondSession);

    const missing = await requestPasswordReset('missing@example.com');
    const existing = await requestPasswordReset(' PASSWORD-RESET@Example.com ');
    expect(missing.status).toBe(202);
    expect(existing.status).toBe(202);
    expect(existing.body).toEqual(missing.body);

    const token = readPasswordResetToken('password-reset@example.com');
    const stored = await prisma.passwordResetToken.findFirstOrThrow();
    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.tokenHash).not.toBe(token);

    const reset = await confirmPasswordReset(
      token,
      'A replacement passphrase 456',
    );
    expect(reset.status).toBe(204);
    expect(readSetCookie(reset)).toContain('__Host-nexora_session=;');
    expect(
      (await prisma.passwordResetToken.findFirstOrThrow()).consumedAt,
    ).not.toBeNull();
    expect(await prisma.session.count({ where: { revokedAt: null } })).toBe(0);
    expect(
      await prisma.auditLog.count({
        where: { action: 'password.reset.completed' },
      }),
    ).toBe(1);

    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', registrationCookie)
      .expect(401);
    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', secondCookie)
      .expect(401);
    expect((await login('password-reset@example.com')).status).toBe(401);
    expect(
      (
        await login(
          'password-reset@example.com',
          'A replacement passphrase 456',
        )
      ).status,
    ).toBe(201);
  });

  it('replaces reset links and allows only one concurrent confirmation', async () => {
    await register('reset-replacement@example.com');
    await requestPasswordReset('reset-replacement@example.com');
    const firstToken = readPasswordResetToken('reset-replacement@example.com');
    await requestPasswordReset('reset-replacement@example.com');
    const secondToken = readPasswordResetToken(
      'reset-replacement@example.com',
      firstToken,
    );

    await confirmPasswordReset(
      firstToken,
      'A replacement passphrase 456',
    ).expect(400);
    const results = await Promise.all([
      confirmPasswordReset(secondToken, 'A concurrent passphrase 456'),
      confirmPasswordReset(secondToken, 'A concurrent passphrase 456'),
    ]);
    expect(results.map((response) => response.status).sort()).toEqual([
      204, 400,
    ]);
    expect(
      await prisma.passwordResetToken.count({
        where: { invalidatedAt: { not: null } },
      }),
    ).toBe(1);
  });

  it('rejects expired and compromised reset attempts without changing the password', async () => {
    await register('reset-invalid@example.com');
    await requestPasswordReset('reset-invalid@example.com');
    const compromisedToken = readPasswordResetToken(
      'reset-invalid@example.com',
    );

    const compromised = await confirmPasswordReset(
      compromisedToken,
      '123456789012345',
    );
    expect(compromised.status).toBe(400);
    expect(readString(compromised.body as unknown, 'error', 'code')).toBe(
      'PASSWORD_RESET_INVALID_PASSWORD',
    );
    expect(
      (await prisma.passwordResetToken.findFirstOrThrow()).consumedAt,
    ).toBeNull();

    await requestPasswordReset('reset-invalid@example.com');
    const expiredToken = readPasswordResetToken(
      'reset-invalid@example.com',
      compromisedToken,
    );
    const latestReset = await prisma.passwordResetToken.findFirstOrThrow({
      orderBy: { createdAt: 'desc' },
    });
    await prisma.passwordResetToken.update({
      where: { id: latestReset.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    await confirmPasswordReset(
      expiredToken,
      'A replacement passphrase 456',
    ).expect(400);
    expect((await login('reset-invalid@example.com')).status).toBe(201);
  });

  it('keeps reset requests generic when delivery fails', async () => {
    await register('reset-delivery@example.com');
    jest
      .spyOn(recordingPasswordResetSender, 'send')
      .mockRejectedValueOnce(new Error('smtp unavailable'));

    const response = await requestPasswordReset('reset-delivery@example.com');

    expect(response.status).toBe(202);
    expect(
      (await prisma.passwordResetToken.findFirstOrThrow()).deliveryStatus,
    ).toBe('FAILED');
  });

  it('changes the password, invalidates reset links, and rotates only the current user sessions', async () => {
    const accountA = await register('password-change-a@example.com');
    const firstCookie = readCookieHeader(accountA);
    const secondSessionA = await login('password-change-a@example.com');
    const secondCookie = readCookieHeader(secondSessionA);
    const userA = readString(accountA.body as unknown, 'data', 'user', 'id');
    const workspaceA = readString(
      accountA.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const originalSession = await prisma.session.findFirstOrThrow({
      where: {
        tokenHash: new SessionTokenService().hash(
          firstCookie.slice(firstCookie.indexOf('=') + 1),
        ),
      },
    });
    await requestPasswordReset('password-change-a@example.com');
    const oldResetToken = readPasswordResetToken(
      'password-change-a@example.com',
    );

    const accountB = await register('password-change-b@example.com');
    const userB = readString(accountB.body as unknown, 'data', 'user', 'id');
    const activeSessionsB = await prisma.session.count({
      where: { userId: userB, revokedAt: null },
    });

    const changed = await changePassword(
      firstCookie,
      'A secure passphrase 123',
      'A replacement passphrase 456',
    );

    expect(changed.status).toBe(204);
    expect(changed.headers['cache-control']).toBe('no-store');
    const rotatedCookie = readCookieHeader(changed);
    expect(rotatedCookie).not.toBe(firstCookie);
    expect(readSetCookie(changed)).toContain('HttpOnly');
    expect(readSetCookie(changed)).toContain('Secure');
    expect(readSetCookie(changed)).toContain('SameSite=Lax');
    expect(readSetCookie(changed)).toContain('Path=/');
    expect(readSetCookie(changed)).not.toContain('Domain=');

    const activeSessionsA = await prisma.session.findMany({
      where: { userId: userA, revokedAt: null },
    });
    expect(activeSessionsA).toHaveLength(1);
    expect(activeSessionsA[0]).toMatchObject({
      activeWorkspaceId: workspaceA,
      expiresAt: originalSession.expiresAt,
    });
    expect(
      await prisma.session.count({ where: { userId: userB, revokedAt: null } }),
    ).toBe(activeSessionsB);
    expect(
      await prisma.passwordResetToken.count({
        where: { userId: userA, invalidatedAt: { not: null } },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: {
          action: 'password.change.completed',
          actorUserId: userA,
          workspaceId: workspaceA,
        },
      }),
    ).toBe(1);

    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', firstCookie)
      .expect(401);
    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', secondCookie)
      .expect(401);
    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', rotatedCookie)
      .expect(200);
    expect((await login('password-change-a@example.com')).status).toBe(401);
    expect(
      (
        await login(
          'password-change-a@example.com',
          'A replacement passphrase 456',
        )
      ).status,
    ).toBe(201);
    await confirmPasswordReset(
      oldResetToken,
      'Another replacement passphrase 789',
    ).expect(400);
  });

  it('accepts normalized Unicode passwords up to the domain code-point limit', async () => {
    const currentPassword = '😀'.repeat(70);
    const decomposedReplacement = 'A re\u0301placement passphrase 456';
    const account = await registerWithPassword(
      'password-change-unicode@example.com',
      currentPassword,
    );

    const changed = await changePassword(
      readCookieHeader(account),
      currentPassword,
      decomposedReplacement,
    );

    expect(changed.status).toBe(204);
    expect(
      (
        await login(
          'password-change-unicode@example.com',
          decomposedReplacement.normalize('NFC'),
        )
      ).status,
    ).toBe(201);
  });

  it('requires a present, unexpired, and unrevoked session for password change', async () => {
    const missing = await request(app.getHttpServer())
      .put('/v1/auth/password')
      .set('Origin', ALLOWED_ORIGIN)
      .send({
        currentPassword: 'A secure passphrase 123',
        newPassword: 'A replacement passphrase 456',
      });
    expect(missing.status).toBe(401);
    expect(missing.headers['set-cookie']).toBeUndefined();

    const account = await register('password-change-session@example.com');
    const expiredCookie = readCookieHeader(account);
    await prisma.session.update({
      where: {
        tokenHash: new SessionTokenService().hash(
          expiredCookie.slice(expiredCookie.indexOf('=') + 1),
        ),
      },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    const expired = await changePassword(
      expiredCookie,
      'A secure passphrase 123',
      'A replacement passphrase 456',
    );
    expect(expired.status).toBe(401);
    expect(expired.headers['set-cookie']).toBeUndefined();

    const signedIn = await login('password-change-session@example.com');
    const revokedCookie = readCookieHeader(signedIn);
    await request(app.getHttpServer())
      .delete('/v1/auth/session')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', revokedCookie)
      .expect(204);
    const revoked = await changePassword(
      revokedCookie,
      'A secure passphrase 123',
      'A replacement passphrase 456',
    );
    expect(revoked.status).toBe(401);
    expect(revoked.headers['set-cookie']).toBeUndefined();
    expect(
      await prisma.auditLog.count({
        where: { action: 'password.change.completed' },
      }),
    ).toBe(0);
    expect((await login('password-change-session@example.com')).status).toBe(
      201,
    );
  });

  it('keeps pending accounts out of authenticated password change without writes', async () => {
    const registration = await registerUnverified(
      'password-change-pending@example.com',
    );
    const cookie = readCookieHeader(registration);
    const credentialBefore = await prisma.passwordCredential.findFirstOrThrow();
    const sessionCount = await prisma.session.count();

    const response = await changePassword(
      cookie,
      'A secure passphrase 123',
      'A replacement passphrase 456',
    );

    expect(response.status).toBe(401);
    expect(readString(response.body as unknown, 'error', 'code')).toBe(
      'AUTHENTICATION_REQUIRED',
    );
    expect(
      (await prisma.passwordCredential.findFirstOrThrow()).passwordHash,
    ).toBe(credentialBefore.passwordHash);
    expect(await prisma.session.count()).toBe(sessionCount);
    expect(
      await prisma.auditLog.count({
        where: { action: 'password.change.completed' },
      }),
    ).toBe(0);
  });

  it('rejects wrong, unchanged, compromised, injected, and cross-origin password changes without writes', async () => {
    const account = await register('password-change-invalid@example.com');
    const cookie = readCookieHeader(account);
    const credentialBefore = await prisma.passwordCredential.findFirstOrThrow();
    const sessionCount = await prisma.session.count();
    const auditCount = await prisma.auditLog.count({
      where: { action: 'password.change.completed' },
    });

    const wrong = await changePassword(
      cookie,
      'A wrong passphrase 123',
      'A replacement passphrase 456',
    );
    expect(wrong.status).toBe(401);
    expect(readString(wrong.body as unknown, 'error', 'code')).toBe(
      'PASSWORD_CHANGE_INVALID_CURRENT_PASSWORD',
    );

    const unchanged = await changePassword(
      cookie,
      'A secure passphrase 123',
      'A secure passphrase 123',
    );
    expect(unchanged.status).toBe(400);
    expect(readString(unchanged.body as unknown, 'error', 'code')).toBe(
      'PASSWORD_CHANGE_INVALID_PASSWORD',
    );

    const compromised = await changePassword(
      cookie,
      'A secure passphrase 123',
      '123456789012345',
    );
    expect(compromised.status).toBe(400);
    expect(readString(compromised.body as unknown, 'error', 'code')).toBe(
      'PASSWORD_CHANGE_INVALID_PASSWORD',
    );

    const findSession = jest.spyOn(prisma.session, 'findUnique');
    await request(app.getHttpServer())
      .put('/v1/auth/password')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', cookie)
      .send({
        currentPassword: 'A secure passphrase 123',
        newPassword: 'A replacement passphrase 456',
        workspaceId: randomUUID(),
        role: 'OWNER',
      })
      .expect(400);
    await request(app.getHttpServer())
      .put('/v1/auth/password')
      .set('Origin', 'https://attacker.example')
      .set('Cookie', cookie)
      .send({
        currentPassword: 'A secure passphrase 123',
        newPassword: 'A replacement passphrase 456',
      })
      .expect(403);
    expect(findSession).not.toHaveBeenCalled();

    expect(
      (await prisma.passwordCredential.findFirstOrThrow()).passwordHash,
    ).toBe(credentialBefore.passwordHash);
    expect(await prisma.session.count()).toBe(sessionCount);
    expect(
      await prisma.auditLog.count({
        where: { action: 'password.change.completed' },
      }),
    ).toBe(auditCount);
  });

  it('rolls back password change and emits no cookie when audit persistence fails', async () => {
    const account = await register('password-change-rollback@example.com');
    const cookie = readCookieHeader(account);
    await requestPasswordReset('password-change-rollback@example.com');
    const credentialBefore = await prisma.passwordCredential.findFirstOrThrow();
    const activeSessionsBefore = await prisma.session.count({
      where: { revokedAt: null },
    });
    jest
      .spyOn(auditLog, 'append')
      .mockRejectedValueOnce(new Error('audit unavailable'));

    const response = await changePassword(
      cookie,
      'A secure passphrase 123',
      'A replacement passphrase 456',
    );

    expect(response.status).toBe(503);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(
      (await prisma.passwordCredential.findFirstOrThrow()).passwordHash,
    ).toBe(credentialBefore.passwordHash);
    expect(await prisma.session.count({ where: { revokedAt: null } })).toBe(
      activeSessionsBefore,
    );
    expect(
      (await prisma.passwordResetToken.findFirstOrThrow()).invalidatedAt,
    ).toBeNull();
    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', cookie)
      .expect(200);
  });

  it('allows only one concurrent change to reuse the old password', async () => {
    const account = await register('password-change-race@example.com');
    const cookie = readCookieHeader(account);
    const [first, second] = await Promise.all([
      changePassword(
        cookie,
        'A secure passphrase 123',
        'First concurrent replacement 456',
      ),
      changePassword(
        cookie,
        'A secure passphrase 123',
        'Second concurrent replacement 789',
      ),
    ]);

    expect([first.status, second.status].sort()).toEqual([204, 401]);
    const winningPassword =
      first.status === 204
        ? 'First concurrent replacement 456'
        : 'Second concurrent replacement 789';
    const losingPassword =
      first.status === 204
        ? 'Second concurrent replacement 789'
        : 'First concurrent replacement 456';
    expect(
      (await login('password-change-race@example.com', winningPassword)).status,
    ).toBe(201);
    expect(
      (await login('password-change-race@example.com', losingPassword)).status,
    ).toBe(401);
  });

  it('rate-limits password changes before current-password verification and fails closed', async () => {
    const account = await register('password-change-limited@example.com');
    const cookie = readCookieHeader(account);
    const verifyCurrent = jest.spyOn(passwordCredentialVerification, 'verify');
    jest
      .spyOn(authenticationRateLimiter, 'checkPasswordChange')
      .mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 60 });

    const limited = await changePassword(
      cookie,
      'A secure passphrase 123',
      'A replacement passphrase 456',
    );
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBe('60');
    expect(verifyCurrent).not.toHaveBeenCalled();

    jest.restoreAllMocks();
    const verifyAfterRestore = jest.spyOn(
      passwordCredentialVerification,
      'verify',
    );
    jest
      .spyOn(authenticationRateLimiter, 'checkPasswordChange')
      .mockRejectedValueOnce(new Error('redis unavailable'));
    const unavailable = await changePassword(
      cookie,
      'A secure passphrase 123',
      'A replacement passphrase 456',
    );
    expect(unavailable.status).toBe(503);
    expect(readString(unavailable.body as unknown, 'error', 'code')).toBe(
      'PASSWORD_CHANGE_UNAVAILABLE',
    );
    expect(verifyAfterRestore).not.toHaveBeenCalled();
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

  it('rejects a locally blocklisted password before creating data', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/registrations')
      .set('Origin', ALLOWED_ORIGIN)
      .send({
        ...registrationBody('compromised-password@example.com'),
        password: '123456789012345',
      });

    expect(response.status).toBe(400);
    expect(readString(response.body as unknown, 'error', 'code')).toBe(
      'REGISTRATION_INVALID',
    );
    expect(await prisma.identity.count()).toBe(0);
    expect(await prisma.passwordCredential.count()).toBe(0);
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

  it('authenticates a returning user with a fresh server-generated session', async () => {
    const registration = await register('returning@example.com');
    const registrationCookie = readCookieHeader(registration);

    const authenticated = await request(app.getHttpServer())
      .post('/v1/auth/sessions')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', '__Host-nexora_session=attacker-controlled')
      .send(loginBody(' RETURNING@Example.com '));

    expect(authenticated.status).toBe(201);
    expect(authenticated.headers['cache-control']).toBe('no-store');
    expect(authenticated.body).toMatchObject({
      data: {
        user: { displayName: 'Owner' },
        organization: { name: 'Nexora Customer' },
        workspace: { name: 'Main Workspace' },
        membership: { role: 'OWNER' },
      },
      meta: {},
    });
    const authenticatedCookie = readCookieHeader(authenticated);
    expect(authenticatedCookie).not.toBe(registrationCookie);
    expect(authenticatedCookie).not.toContain('attacker-controlled');
    expect(readSetCookie(authenticated)).toContain('HttpOnly');
    expect(readSetCookie(authenticated)).toContain('Secure');
    expect(readSetCookie(authenticated)).toContain('SameSite=Lax');
    expect(readSetCookie(authenticated)).toContain('Path=/');
    expect(readSetCookie(authenticated)).not.toContain('Domain=');
    expect(await prisma.session.count()).toBe(2);
    expect(
      await prisma.auditLog.count({
        where: { action: 'auth.session.created' },
      }),
    ).toBe(1);

    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', authenticatedCookie)
      .expect(200);
  });

  it('uses one generic failure for unknown and incorrect credentials', async () => {
    await register('known@example.com');
    const sessionCount = await prisma.session.count();

    const wrong = await login('known@example.com', 'A wrong passphrase 123');
    const missing = await login(
      'missing@example.com',
      'A wrong passphrase 123',
    );

    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    for (const response of [wrong, missing]) {
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toMatchObject({
        error: {
          code: 'AUTHENTICATION_INVALID',
          message: 'Email or password is incorrect.',
          retryable: false,
        },
      });
    }
    expect(await prisma.session.count()).toBe(sessionCount);
    expect(
      await prisma.auditLog.count({
        where: { action: 'auth.session.created' },
      }),
    ).toBe(0);
  });

  it('rolls back session creation when its audit record cannot be written', async () => {
    await register('login-rollback@example.com');
    const sessionCount = await prisma.session.count();
    jest
      .spyOn(auditLog, 'append')
      .mockRejectedValueOnce(new Error('audit unavailable'));

    const response = await login('login-rollback@example.com');
    expect(response.status).toBe(503);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(await prisma.session.count()).toBe(sessionCount);
    expect(
      await prisma.auditLog.count({
        where: { action: 'auth.session.created' },
      }),
    ).toBe(0);
  });

  it('rejects tenant injection, disallowed origins, and ambiguous workspace selection during login', async () => {
    const registration = await register('workspace-choice@example.com');
    const userId = readString(
      registration.body as unknown,
      'data',
      'user',
      'id',
    );

    const injected = await request(app.getHttpServer())
      .post('/v1/auth/sessions')
      .set('Origin', ALLOWED_ORIGIN)
      .send({
        ...loginBody('workspace-choice@example.com'),
        workspaceId: randomUUID(),
        role: 'OWNER',
      });
    expect(injected.status).toBe(400);

    const crossOrigin = await request(app.getHttpServer())
      .post('/v1/auth/sessions')
      .set('Origin', 'https://attacker.example')
      .send(loginBody('workspace-choice@example.com'));
    expect(crossOrigin.status).toBe(403);

    const organizationId = randomUUID();
    const workspaceId = randomUUID();
    await prisma.organization.create({
      data: { id: organizationId, ownerUserId: userId, name: 'Second Org' },
    });
    await prisma.workspace.create({
      data: { id: workspaceId, organizationId, name: 'Second Workspace' },
    });
    await prisma.membership.create({
      data: {
        id: randomUUID(),
        workspaceId,
        userId,
        role: 'OWNER',
      },
    });

    const ambiguous = await login('workspace-choice@example.com');
    expect(ambiguous.status).toBe(401);
    expect(readString(ambiguous.body as unknown, 'error', 'code')).toBe(
      'AUTHENTICATION_INVALID',
    );
    expect(await prisma.session.count()).toBe(1);
  });

  it('rate-limits login before credential verification and fails safely when enforcement is unavailable', async () => {
    const authenticate = jest
      .spyOn(passwordIdentities, 'authenticate')
      .mockResolvedValue(null);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/sessions')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-Forwarded-For', '203.0.113.20')
        .send(loginBody('limited-login@example.com'));
      expect(response.status).toBe(401);
    }

    const limited = await request(app.getHttpServer())
      .post('/v1/auth/sessions')
      .set('Origin', ALLOWED_ORIGIN)
      .set('X-Forwarded-For', '203.0.113.20')
      .send(loginBody('limited-login@example.com'));
    expect(limited.status).toBe(429);
    expect(readString(limited.body as unknown, 'error', 'code')).toBe(
      'AUTHENTICATION_RATE_LIMITED',
    );
    expect(limited.headers['retry-after']).toBeDefined();
    expect(authenticate).toHaveBeenCalledTimes(10);

    await redis.client.flushDb();
    authenticate.mockClear();
    jest
      .spyOn(authenticationRateLimiter, 'checkLogin')
      .mockRejectedValueOnce(new Error('redis unavailable'));
    const unavailable = await login('unavailable@example.com');
    expect(unavailable.status).toBe(503);
    expect(readString(unavailable.body as unknown, 'error', 'code')).toBe(
      'AUTHENTICATION_UNAVAILABLE',
    );
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('revokes only the current session, tolerates cache failure, and remains idempotent', async () => {
    const registration = await register('logout@example.com');
    const registrationCookie = readCookieHeader(registration);
    const authenticated = await login('logout@example.com');
    const authenticatedCookie = readCookieHeader(authenticated);
    jest
      .spyOn(sessionCache, 'remove')
      .mockRejectedValueOnce(new Error('redis cache unavailable'));

    const [logout, concurrentLogout] = await Promise.all([
      request(app.getHttpServer())
        .delete('/v1/auth/session')
        .set('Origin', ALLOWED_ORIGIN)
        .set('Cookie', authenticatedCookie),
      request(app.getHttpServer())
        .delete('/v1/auth/session')
        .set('Origin', ALLOWED_ORIGIN)
        .set('Cookie', authenticatedCookie),
    ]);
    expect([logout.status, concurrentLogout.status]).toEqual([204, 204]);
    expect(readSetCookie(logout)).toContain('__Host-nexora_session=;');
    expect(readSetCookie(logout)).toContain('Expires=');
    expect(readSetCookie(logout)).toContain('Max-Age=0');
    expect(await prisma.session.count({ where: { revokedAt: null } })).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { action: 'auth.session.revoked' },
      }),
    ).toBe(1);

    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', authenticatedCookie)
      .expect(401);
    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', registrationCookie)
      .expect(200);
    await request(app.getHttpServer())
      .delete('/v1/auth/session')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', authenticatedCookie)
      .expect(204);
    const anonymousLogout = await request(app.getHttpServer())
      .delete('/v1/auth/session')
      .set('Origin', ALLOWED_ORIGIN)
      .expect(204);
    expect(readSetCookie(anonymousLogout)).toContain('__Host-nexora_session=;');
    expect(
      await prisma.auditLog.count({
        where: { action: 'auth.session.revoked' },
      }),
    ).toBe(1);
  });

  it('rolls back revocation when its audit record cannot be written', async () => {
    const registration = await register('logout-rollback@example.com');
    const cookie = readCookieHeader(registration);
    jest
      .spyOn(auditLog, 'append')
      .mockRejectedValueOnce(new Error('audit unavailable'));

    const response = await request(app.getHttpServer())
      .delete('/v1/auth/session')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', cookie);
    expect(response.status).toBe(503);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(await prisma.session.count({ where: { revokedAt: null } })).toBe(1);
  });

  it('revokes every session for the current user without affecting another tenant', async () => {
    const accountA = await register('revoke-all-a@example.com');
    const loginA = await login('revoke-all-a@example.com');
    const userA = readString(accountA.body as unknown, 'data', 'user', 'id');
    const accountB = await register('revoke-all-b@example.com');
    const loginB = await login('revoke-all-b@example.com');
    const userB = readString(accountB.body as unknown, 'data', 'user', 'id');

    await request(app.getHttpServer())
      .delete('/v1/auth/sessions')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', readCookieHeader(loginA))
      .expect(204);

    expect(
      await prisma.session.count({ where: { userId: userA, revokedAt: null } }),
    ).toBe(0);
    expect(
      await prisma.session.count({ where: { userId: userB, revokedAt: null } }),
    ).toBe(2);
    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', readCookieHeader(accountA))
      .expect(401);
    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', readCookieHeader(loginB))
      .expect(200);
    expect(
      await prisma.auditLog.count({
        where: { action: 'auth.sessions.revoked_all', actorUserId: userA },
      }),
    ).toBe(1);
  });

  it('allows a pending user to revoke every session without full tenant admission', async () => {
    const registration = await registerUnverified(
      'revoke-all-pending@example.com',
    );
    const userId = readString(
      registration.body as unknown,
      'data',
      'user',
      'id',
    );

    await request(app.getHttpServer())
      .delete('/v1/auth/sessions')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', readCookieHeader(registration))
      .expect(204);

    expect(
      await prisma.session.count({ where: { userId, revokedAt: null } }),
    ).toBe(0);
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
      .set('X-User-Id', randomUUID())
      .set('X-Workspace-Id', workspaceB)
      .set('X-Membership-Role', 'OWNER')
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

  it('keeps current-session authentication failures private and non-cacheable', async () => {
    const missing = await request(app.getHttpServer()).get('/v1/auth/session');
    expect(missing.status).toBe(401);
    expect(missing.headers['cache-control']).toBe('no-store');
    expect(missing.headers.pragma).toBe('no-cache');

    const registration = await register('session-database-outage@example.com');
    const cookie = readCookieHeader(registration);
    jest
      .spyOn(prisma.session, 'findUnique')
      .mockRejectedValueOnce(new Error('database unavailable'));

    const unavailable = await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', cookie);
    expect(unavailable.status).toBe(503);
    expect(readString(unavailable.body as unknown, 'error', 'code')).toBe(
      'AUTHENTICATION_UNAVAILABLE',
    );
    expect(unavailable.headers['cache-control']).toBe('no-store');
    expect(unavailable.headers.pragma).toBe('no-cache');
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

  async function register(email: string) {
    const response = await registerUnverified(email);
    if (response.status === 201) {
      await confirmEmail(await readVerificationToken(email)).expect(204);
    }
    return response;
  }

  async function registerWithPassword(email: string, password: string) {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/registrations')
      .set('Origin', ALLOWED_ORIGIN)
      .send({ ...registrationBody(email), password });
    if (response.status === 201) {
      await confirmEmail(await readVerificationToken(email)).expect(204);
    }
    return response;
  }

  function registerUnverified(email: string) {
    return request(app.getHttpServer())
      .post('/v1/auth/registrations')
      .set('Origin', ALLOWED_ORIGIN)
      .send(registrationBody(email));
  }

  function login(email: string, password = 'A secure passphrase 123') {
    return request(app.getHttpServer())
      .post('/v1/auth/sessions')
      .set('Origin', ALLOWED_ORIGIN)
      .send(loginBody(email, password));
  }

  function confirmEmail(token: string) {
    return request(app.getHttpServer())
      .post('/v1/auth/email-verifications')
      .set('Origin', ALLOWED_ORIGIN)
      .send({ token });
  }

  function requestPasswordReset(email: string) {
    return request(app.getHttpServer())
      .post('/v1/auth/password-reset-requests')
      .set('Origin', ALLOWED_ORIGIN)
      .send({ email });
  }

  function confirmPasswordReset(token: string, newPassword: string) {
    return request(app.getHttpServer())
      .post('/v1/auth/password-resets')
      .set('Origin', ALLOWED_ORIGIN)
      .send({ token, newPassword });
  }

  function changePassword(
    cookie: string,
    currentPassword: string,
    newPassword: string,
  ) {
    return request(app.getHttpServer())
      .put('/v1/auth/password')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', cookie)
      .send({ currentPassword, newPassword });
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

function loginBody(email: string, password = 'A secure passphrase 123') {
  return { email, password };
}

function readSetCookie(response: { headers: Record<string, unknown> }): string {
  const setCookie = response.headers['set-cookie'];
  if (!Array.isArray(setCookie) || typeof setCookie[0] !== 'string') {
    throw new Error('Expected a Set-Cookie header.');
  }
  return setCookie[0];
}

function readCookieHeader(response: {
  headers: Record<string, unknown>;
}): string {
  return readSetCookie(response).split(';', 1)[0];
}

async function clearRegistrationData(prisma: PrismaService): Promise<void> {
  await prisma.auditLog.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.emailVerification.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
  await prisma.passwordCredential.deleteMany();
  await prisma.identity.deleteMany();
}

function readVerificationToken(
  email: string,
  excludedToken?: string,
): Promise<string> {
  const normalizedEmail = email.trim().toLocaleLowerCase('en-US');
  for (const delivery of [...verificationDeliveries].reverse()) {
    if (
      delivery.to.toLowerCase() === normalizedEmail &&
      delivery.token !== excludedToken
    ) {
      return Promise.resolve(delivery.token);
    }
  }
  throw new Error(
    `Verification email was not delivered to ${normalizedEmail}.`,
  );
}

function readPasswordResetToken(email: string, excludedToken?: string): string {
  const normalizedEmail = email.trim().toLocaleLowerCase('en-US');
  for (const delivery of [...resetDeliveries].reverse()) {
    if (
      delivery.to.toLowerCase() === normalizedEmail &&
      delivery.token !== excludedToken
    ) {
      return delivery.token;
    }
  }
  throw new Error(
    `Password reset email was not delivered to ${normalizedEmail}.`,
  );
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
