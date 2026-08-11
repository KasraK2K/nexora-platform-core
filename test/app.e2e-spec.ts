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
import {
  MEMBERSHIP_INVITATION_SENDER,
  type MembershipInvitationSender,
} from '../src/core/memberships/application/membership-invitation-sender.port';
import { MembershipInvitationRateLimiter } from '../src/core/memberships/infrastructure/membership-invitation-rate-limiter';
import { MembershipOwnershipTransferRateLimiter } from '../src/core/memberships/infrastructure/membership-ownership-transfer-rate-limiter';
import { PrismaMembershipInvitationsRepository } from '../src/core/memberships/infrastructure/prisma-membership-invitations.repository';
import {
  AuthenticatedRoute,
  PublicRoute,
} from '../src/core/authorization/presentation/route-admission';
import { CurrentAuthenticatedContext } from '../src/core/authentication/presentation/authenticated-request-context';
import type { AuthenticatedRequestContext } from '../src/core/authentication/application/authenticated-request-context';
import { ApplicationError } from '../src/shared/domain/application-error';

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
const invitationDeliveries: Array<{
  to: string;
  token: string;
  role: 'ADMIN' | 'MEMBER';
  expiresAt: Date;
}> = [];
const recordingMembershipInvitationSender: MembershipInvitationSender = {
  send(input) {
    invitationDeliveries.push(input);
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

  @Get('unsafe-error-details')
  @PublicRoute()
  unsafeErrorDetails(): never {
    throw new UnsafeDetailsError();
  }

  @Get('unsafe-workspace-selection-details')
  @PublicRoute()
  unsafeWorkspaceSelectionDetails(): never {
    throw new UnsafeWorkspaceSelectionDetailsError();
  }
}

class UnsafeDetailsError extends ApplicationError {
  readonly code = 'UNSAFE_DETAILS_TEST';
  readonly retryable = false;
  readonly details = { secret: 'must-not-leak', sql: 'select sensitive' };

  constructor() {
    super('Safe public message.');
  }
}

class UnsafeWorkspaceSelectionDetailsError extends ApplicationError {
  readonly code = 'WORKSPACE_SELECTION_REQUIRED';
  readonly retryable = false;
  readonly details = {
    availableWorkspaces: [
      {
        organization: { id: 'organization-id', name: 'Organization' },
        workspace: { id: 'workspace-id', name: 'Workspace' },
        membership: { role: 'OWNER' },
        secret: 'must-not-leak',
      },
    ],
    sql: 'select sensitive',
  };

  constructor() {
    super('Select a workspace to continue.');
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
  let membershipInvitationRateLimiter: MembershipInvitationRateLimiter;
  let membershipOwnershipTransferRateLimiter: MembershipOwnershipTransferRateLimiter;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [RouteAdmissionProbeController],
    })
      .overrideProvider(EMAIL_VERIFICATION_SENDER)
      .useValue(recordingEmailSender)
      .overrideProvider(PASSWORD_RESET_SENDER)
      .useValue(recordingPasswordResetSender)
      .overrideProvider(MEMBERSHIP_INVITATION_SENDER)
      .useValue(recordingMembershipInvitationSender)
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
    membershipInvitationRateLimiter = app.get(MembershipInvitationRateLimiter);
    membershipOwnershipTransferRateLimiter = app.get(
      MembershipOwnershipTransferRateLimiter,
    );
  });

  beforeEach(async () => {
    await clearRegistrationData(prisma);
    await redis.client.flushDb();
    verificationDeliveries.length = 0;
    resetDeliveries.length = 0;
    invitationDeliveries.length = 0;
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

  it('does not serialize arbitrary application-error details', async () => {
    const response = await request(app.getHttpServer())
      .get('/__test/route-admission/unsafe-error-details')
      .expect(500);

    expect(response.body).toMatchObject({
      error: {
        code: 'UNSAFE_DETAILS_TEST',
        message: 'Safe public message.',
        retryable: false,
      },
    });
    expect(hasPath(response.body as unknown, 'error', 'details')).toBe(false);
    expect(JSON.stringify(response.body)).not.toContain('must-not-leak');
    expect(JSON.stringify(response.body)).not.toContain('select sensitive');

    const selection = await request(app.getHttpServer())
      .get('/__test/route-admission/unsafe-workspace-selection-details')
      .expect(409);
    expect(selection.body).toMatchObject({
      error: {
        details: {
          availableWorkspaces: [
            {
              organization: { id: 'organization-id', name: 'Organization' },
              workspace: { id: 'workspace-id', name: 'Workspace' },
              membership: { role: 'OWNER' },
            },
          ],
        },
      },
    });
    expect(JSON.stringify(selection.body)).not.toContain('must-not-leak');
    expect(JSON.stringify(selection.body)).not.toContain('select sensitive');
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

  it('requires an explicit authorized workspace for multi-workspace login', async () => {
    const registration = await register('workspace-choice@example.com');
    const userId = readString(
      registration.body as unknown,
      'data',
      'user',
      'id',
    );
    const initialWorkspaceId = readString(
      registration.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const second = await createWorkspaceMembership(
      prisma,
      userId,
      'Second Org',
      'Second Workspace',
    );

    const injected = await request(app.getHttpServer())
      .post('/v1/auth/sessions')
      .set('Origin', ALLOWED_ORIGIN)
      .send({
        ...loginBody('workspace-choice@example.com'),
        workspaceId: second.workspaceId,
        role: 'OWNER',
      });
    expect(injected.status).toBe(400);

    const crossOrigin = await request(app.getHttpServer())
      .post('/v1/auth/sessions')
      .set('Origin', 'https://attacker.example')
      .send(loginBody('workspace-choice@example.com'));
    expect(crossOrigin.status).toBe(403);

    const ambiguous = await login('workspace-choice@example.com');
    expect(ambiguous.status).toBe(409);
    expect(readString(ambiguous.body as unknown, 'error', 'code')).toBe(
      'WORKSPACE_SELECTION_REQUIRED',
    );
    expect(ambiguous.headers['set-cookie']).toBeUndefined();
    expect(ambiguous.body).toMatchObject({
      error: {
        details: {
          availableWorkspaces: [
            { workspace: { id: initialWorkspaceId } },
            { workspace: { id: second.workspaceId } },
          ],
        },
      },
    });
    expect(await prisma.session.count()).toBe(1);

    const inaccessible = await login(
      'workspace-choice@example.com',
      'A secure passphrase 123',
      randomUUID(),
    );
    expect(inaccessible.status).toBe(401);
    expect(readString(inaccessible.body as unknown, 'error', 'code')).toBe(
      'AUTHENTICATION_INVALID',
    );
    expect(inaccessible.headers['set-cookie']).toBeUndefined();

    const selected = await login(
      'workspace-choice@example.com',
      'A secure passphrase 123',
      second.workspaceId,
    );
    expect(selected.status).toBe(201);
    expect(
      readString(selected.body as unknown, 'data', 'workspace', 'id'),
    ).toBe(second.workspaceId);
    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', readCookieHeader(selected))
      .expect(200)
      .expect(({ body }) => {
        expect(readString(body as unknown, 'data', 'workspace', 'id')).toBe(
          second.workspaceId,
        );
      });
  });

  it('lists only the actor workspaces and rotates one session when switching', async () => {
    const registration = await register('workspace-switch@example.com');
    const userId = readString(
      registration.body as unknown,
      'data',
      'user',
      'id',
    );
    const initialWorkspaceId = readString(
      registration.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const second = await createWorkspaceMembership(
      prisma,
      userId,
      'Second Org',
      'Second Workspace',
    );
    const selectedLogin = await login(
      'workspace-switch@example.com',
      'A secure passphrase 123',
      second.workspaceId,
    );
    const selectedCookie = readCookieHeader(selectedLogin);
    const selectedTokenHash = new SessionTokenService().hash(
      selectedCookie.slice(selectedCookie.indexOf('=') + 1),
    );
    const selectedSession = await prisma.session.findUniqueOrThrow({
      where: { tokenHash: selectedTokenHash },
    });

    const otherAccount = await register('workspace-switch-other@example.com');
    const otherWorkspaceId = readString(
      otherAccount.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const listed = await request(app.getHttpServer())
      .get('/v1/auth/session/workspaces')
      .set('Cookie', selectedCookie)
      .set('X-Workspace-Id', otherWorkspaceId)
      .expect(200);
    const listedIds = readArray(listed.body as unknown, 'data').map((value) =>
      readString(value, 'workspace', 'id'),
    );
    expect(listedIds).toEqual([initialWorkspaceId, second.workspaceId]);
    expect(listedIds).not.toContain(otherWorkspaceId);
    expect(
      readString(listed.body as unknown, 'meta', 'activeWorkspaceId'),
    ).toBe(second.workspaceId);

    const sessionCount = await prisma.session.count();
    const auditCount = await prisma.auditLog.count();
    const crossOrigin = await request(app.getHttpServer())
      .put('/v1/auth/session/workspace')
      .set('Origin', 'https://attacker.example')
      .set('Cookie', selectedCookie)
      .send({ workspaceId: initialWorkspaceId });
    expect(crossOrigin.status).toBe(403);
    const injected = await request(app.getHttpServer())
      .put('/v1/auth/session/workspace')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', selectedCookie)
      .send({ workspaceId: initialWorkspaceId, role: 'OWNER' });
    expect(injected.status).toBe(400);
    expect(await prisma.session.count()).toBe(sessionCount);
    expect(await prisma.auditLog.count()).toBe(auditCount);

    const denied = await switchWorkspace(selectedCookie, otherWorkspaceId);
    expect(denied.status).toBe(403);
    expect(readString(denied.body as unknown, 'error', 'code')).toBe(
      'WORKSPACE_ACCESS_DENIED',
    );
    expect(await prisma.session.count()).toBe(sessionCount);
    expect(await prisma.auditLog.count()).toBe(auditCount);

    const unchanged = await switchWorkspace(selectedCookie, second.workspaceId);
    expect(unchanged.status).toBe(200);
    expect(readCookieHeader(unchanged)).toBe(selectedCookie);
    expect(unchanged.body).toMatchObject({ meta: { sessionRotated: false } });
    expect(await prisma.auditLog.count()).toBe(auditCount);

    const switched = await switchWorkspace(selectedCookie, initialWorkspaceId);
    expect(switched.status).toBe(200);
    expect(switched.body).toMatchObject({
      data: { workspace: { id: initialWorkspaceId } },
      meta: { sessionRotated: true },
    });
    const switchedCookie = readCookieHeader(switched);
    expect(switchedCookie).not.toBe(selectedCookie);
    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', selectedCookie)
      .expect(401);
    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', switchedCookie)
      .expect(200)
      .expect(({ body }) => {
        expect(readString(body as unknown, 'data', 'workspace', 'id')).toBe(
          initialWorkspaceId,
        );
      });

    const replacementHash = new SessionTokenService().hash(
      switchedCookie.slice(switchedCookie.indexOf('=') + 1),
    );
    const replacement = await prisma.session.findUniqueOrThrow({
      where: { tokenHash: replacementHash },
    });
    expect(replacement.expiresAt).toEqual(selectedSession.expiresAt);
    expect(replacement.activeWorkspaceId).toBe(initialWorkspaceId);
    expect(
      await prisma.auditLog.findMany({
        where: { action: 'auth.workspace.switched', actorUserId: userId },
        orderBy: { workspaceId: 'asc' },
        select: { workspaceId: true },
      }),
    ).toEqual(
      [initialWorkspaceId, second.workspaceId]
        .sort()
        .map((workspaceId) => ({ workspaceId })),
    );
  });

  it('does not allow pending users to list or switch workspaces', async () => {
    const registration = await registerUnverified(
      'workspace-switch-pending@example.com',
    );
    const cookie = readCookieHeader(registration);
    const workspaceId = readString(
      registration.body as unknown,
      'data',
      'workspace',
      'id',
    );

    await request(app.getHttpServer())
      .get('/v1/auth/session/workspaces')
      .set('Cookie', cookie)
      .expect(403);
    await switchWorkspace(cookie, workspaceId).expect(403);
  });

  it('rolls back switching on audit failure and fails closed on limiter failure', async () => {
    const registration = await register('workspace-switch-failure@example.com');
    const userId = readString(
      registration.body as unknown,
      'data',
      'user',
      'id',
    );
    const initialWorkspaceId = readString(
      registration.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const second = await createWorkspaceMembership(
      prisma,
      userId,
      'Second Org',
      'Second Workspace',
    );
    const selected = await login(
      'workspace-switch-failure@example.com',
      'A secure passphrase 123',
      second.workspaceId,
    );
    const cookie = readCookieHeader(selected);
    const sessionCount = await prisma.session.count();
    const auditCount = await prisma.auditLog.count();

    jest
      .spyOn(auditLog, 'append')
      .mockRejectedValueOnce(new Error('audit unavailable'));
    const failed = await switchWorkspace(cookie, initialWorkspaceId);
    expect(failed.status).toBe(503);
    expect(failed.headers['set-cookie']).toBeUndefined();
    expect(await prisma.session.count()).toBe(sessionCount);
    expect(await prisma.auditLog.count()).toBe(auditCount);
    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', cookie)
      .expect(200);

    jest.restoreAllMocks();
    jest
      .spyOn(authenticationRateLimiter, 'checkWorkspaceSwitch')
      .mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 30 });
    const limited = await switchWorkspace(cookie, initialWorkspaceId);
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBe('30');
    expect(await prisma.session.count()).toBe(sessionCount);
    expect(await prisma.auditLog.count()).toBe(auditCount);

    jest
      .spyOn(authenticationRateLimiter, 'checkWorkspaceSwitch')
      .mockRejectedValueOnce(new Error('redis unavailable'));
    const unavailable = await switchWorkspace(cookie, initialWorkspaceId);
    expect(unavailable.status).toBe(503);
    expect(await prisma.session.count()).toBe(sessionCount);
    expect(await prisma.auditLog.count()).toBe(auditCount);
  });

  it('allows only one concurrent switch for the same presented session', async () => {
    const registration = await register('workspace-switch-race@example.com');
    const userId = readString(
      registration.body as unknown,
      'data',
      'user',
      'id',
    );
    const initialWorkspaceId = readString(
      registration.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const second = await createWorkspaceMembership(
      prisma,
      userId,
      'Second Org',
      'Second Workspace',
    );
    const selected = await login(
      'workspace-switch-race@example.com',
      'A secure passphrase 123',
      second.workspaceId,
    );
    const cookie = readCookieHeader(selected);

    const responses = await Promise.all([
      switchWorkspace(cookie, initialWorkspaceId),
      switchWorkspace(cookie, initialWorkspaceId),
    ]);

    expect(responses.map(({ status }) => status).sort()).toEqual([200, 401]);
    expect(
      await prisma.session.count({ where: { userId, revokedAt: null } }),
    ).toBe(2);
    expect(
      await prisma.auditLog.count({
        where: { action: 'auth.workspace.switched', actorUserId: userId },
      }),
    ).toBe(2);
  });

  it('applies OWNER, ADMIN, and MEMBER invitation permissions end to end', async () => {
    const owner = await register('rbac-owner@example.com');
    const ownerCookie = readCookieHeader(owner);
    const ownerWorkspaceId = readString(
      owner.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const admin = await register('rbac-admin@example.com');
    const adminCookie = readCookieHeader(admin);

    const injected = await request(app.getHttpServer())
      .post('/v1/membership-invitations')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', ownerCookie)
      .set('X-Workspace-Id', randomUUID())
      .send({
        email: 'rbac-admin@example.com',
        role: 'ADMIN',
        workspaceId: randomUUID(),
      });
    expect(injected.status).toBe(400);
    expect(invitationDeliveries).toHaveLength(0);

    const issued = await createInvitation(
      ownerCookie,
      'RBAC-Admin@Example.com',
      'ADMIN',
    );
    expect(issued.status).toBe(201);
    expect(issued.body).toMatchObject({
      data: {
        workspaceId: ownerWorkspaceId,
        email: 'rbac-admin@example.com',
        role: 'ADMIN',
      },
      meta: { invitationEmailSent: true },
    });
    const adminToken = readInvitationToken('rbac-admin@example.com');
    const persisted = await prisma.membershipInvitation.findFirstOrThrow();
    expect(persisted.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(persisted.tokenHash).not.toBe(adminToken);
    expect(JSON.stringify(issued.body)).not.toContain(adminToken);

    await acceptInvitation(adminCookie, adminToken).expect(204);
    const adminUserId = readString(admin.body as unknown, 'data', 'user', 'id');
    await expect(
      prisma.membership.findUniqueOrThrow({
        where: {
          workspaceId_userId: {
            workspaceId: ownerWorkspaceId,
            userId: adminUserId,
          },
        },
      }),
    ).resolves.toMatchObject({ role: 'ADMIN' });

    const ambiguousAdmin = await login('rbac-admin@example.com');
    expect(ambiguousAdmin.status).toBe(409);
    expect(
      readArray(
        ambiguousAdmin.body as unknown,
        'error',
        'details',
        'availableWorkspaces',
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ membership: { role: 'ADMIN' } }),
      ]),
    );

    const adminWorkspaces = await request(app.getHttpServer())
      .get('/v1/auth/session/workspaces')
      .set('Cookie', adminCookie)
      .expect(200);
    expect(readArray(adminWorkspaces.body as unknown, 'data')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ membership: { role: 'ADMIN' } }),
      ]),
    );
    const switchedAdmin = await switchWorkspace(adminCookie, ownerWorkspaceId);
    expect(switchedAdmin.status).toBe(200);
    expect(switchedAdmin.body).toMatchObject({
      data: { membership: { role: 'ADMIN' } },
    });

    const selectedAdmin = await login(
      'rbac-admin@example.com',
      'A secure passphrase 123',
      ownerWorkspaceId,
    );
    expect(selectedAdmin.status).toBe(201);
    expect(selectedAdmin.body).toMatchObject({
      data: { membership: { role: 'ADMIN' } },
    });
    const selectedAdminCookie = readCookieHeader(selectedAdmin);
    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', selectedAdminCookie)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          data: { membership: { role: 'ADMIN' } },
        }),
      );

    const member = await register('rbac-member@example.com');
    const memberCookie = readCookieHeader(member);
    const memberInvite = await createInvitation(
      selectedAdminCookie,
      'rbac-member@example.com',
      'MEMBER',
    );
    expect(memberInvite.status).toBe(201);
    await acceptInvitation(
      memberCookie,
      readInvitationToken('rbac-member@example.com'),
    ).expect(204);

    const selectedMember = await login(
      'rbac-member@example.com',
      'A secure passphrase 123',
      ownerWorkspaceId,
    );
    expect(selectedMember.status).toBe(201);
    expect(selectedMember.body).toMatchObject({
      data: { membership: { role: 'MEMBER' } },
    });
    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', readCookieHeader(selectedMember))
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          data: { membership: { role: 'MEMBER' } },
        }),
      );
    const memberDenied = await createInvitation(
      readCookieHeader(selectedMember),
      'someone@example.com',
      'MEMBER',
    );
    expect(memberDenied.status).toBe(403);
    expect(readString(memberDenied.body as unknown, 'error', 'code')).toBe(
      'AUTHORIZATION_DENIED',
    );

    const adminEscalationDenied = await createInvitation(
      selectedAdminCookie,
      'another@example.com',
      'ADMIN',
    );
    expect(adminEscalationDenied.status).toBe(403);
    expect(
      readString(adminEscalationDenied.body as unknown, 'error', 'code'),
    ).toBe('AUTHORIZATION_DENIED');
  });

  it('administers active-workspace memberships with tenant isolation and scoped session revocation', async () => {
    const owner = await register('membership-admin-owner@example.com');
    const ownerCookie = readCookieHeader(owner);
    const ownerWorkspaceId = readString(
      owner.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const ownerMembership = await prisma.membership.findFirstOrThrow({
      where: { workspaceId: ownerWorkspaceId, role: 'OWNER' },
    });
    const admin = await register('membership-admin-admin@example.com');
    const adminHomeCookie = readCookieHeader(admin);
    const member = await register('membership-admin-member@example.com');
    const memberHomeCookie = readCookieHeader(member);

    await createInvitation(
      ownerCookie,
      'membership-admin-admin@example.com',
      'ADMIN',
    ).expect(201);
    await acceptInvitation(
      adminHomeCookie,
      readInvitationToken('membership-admin-admin@example.com'),
    ).expect(204);
    await createInvitation(
      ownerCookie,
      'membership-admin-member@example.com',
      'MEMBER',
    ).expect(201);
    await acceptInvitation(
      memberHomeCookie,
      readInvitationToken('membership-admin-member@example.com'),
    ).expect(204);

    const adminUserId = readString(admin.body as unknown, 'data', 'user', 'id');
    const memberUserId = readString(
      member.body as unknown,
      'data',
      'user',
      'id',
    );
    const adminMembership = await prisma.membership.findUniqueOrThrow({
      where: {
        workspaceId_userId: {
          workspaceId: ownerWorkspaceId,
          userId: adminUserId,
        },
      },
    });
    const memberMembership = await prisma.membership.findUniqueOrThrow({
      where: {
        workspaceId_userId: {
          workspaceId: ownerWorkspaceId,
          userId: memberUserId,
        },
      },
    });
    const selectedAdmin = await login(
      'membership-admin-admin@example.com',
      'A secure passphrase 123',
      ownerWorkspaceId,
    );
    const selectedAdminCookie = readCookieHeader(selectedAdmin);
    const selectedMember = await login(
      'membership-admin-member@example.com',
      'A secure passphrase 123',
      ownerWorkspaceId,
    );
    const secondSelectedMember = await login(
      'membership-admin-member@example.com',
      'A secure passphrase 123',
      ownerWorkspaceId,
    );

    const firstPage = await request(app.getHttpServer())
      .get('/v1/memberships?limit=2')
      .set('Cookie', ownerCookie)
      .expect(200);
    const nextCursor = readString(
      firstPage.body as unknown,
      'meta',
      'nextCursor',
    );
    const secondPage = await request(app.getHttpServer())
      .get(`/v1/memberships?limit=2&cursor=${nextCursor}`)
      .set('Cookie', ownerCookie)
      .expect(200);
    expect([
      ...readArray(firstPage.body as unknown, 'data'),
      ...readArray(secondPage.body as unknown, 'data'),
    ]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: ownerMembership.id, role: 'OWNER' }),
        expect.objectContaining({ id: adminMembership.id, role: 'ADMIN' }),
        expect.objectContaining({ id: memberMembership.id, role: 'MEMBER' }),
      ]),
    );
    await request(app.getHttpServer())
      .get('/v1/memberships')
      .set('Cookie', readCookieHeader(selectedMember))
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/v1/memberships/${adminMembership.id}/role`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', ownerCookie)
      .send({ role: 'MEMBER', workspaceId: randomUUID() })
      .expect(400);
    await changeMembershipRole(
      ownerCookie,
      ownerMembership.id,
      'MEMBER',
    ).expect(409);

    const foreign = await register('membership-admin-foreign@example.com');
    const foreignWorkspaceId = readString(
      foreign.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const foreignMembership = await prisma.membership.findFirstOrThrow({
      where: { workspaceId: foreignWorkspaceId },
    });
    await changeMembershipRole(
      ownerCookie,
      foreignMembership.id,
      'MEMBER',
    ).expect(204);
    await removeWorkspaceMembership(ownerCookie, foreignMembership.id).expect(
      204,
    );
    await request(app.getHttpServer())
      .get(`/v1/memberships?cursor=${foreignMembership.id}`)
      .set('Cookie', ownerCookie)
      .expect(400);
    expect(
      await prisma.membership.findUniqueOrThrow({
        where: { id: foreignMembership.id },
      }),
    ).toMatchObject({ removedAt: null, role: 'OWNER' });

    await changeMembershipRole(
      ownerCookie,
      adminMembership.id,
      'MEMBER',
    ).expect(204);
    await request(app.getHttpServer())
      .get('/v1/memberships')
      .set('Cookie', selectedAdminCookie)
      .expect(403);
    await changeMembershipRole(ownerCookie, adminMembership.id, 'ADMIN').expect(
      204,
    );
    await request(app.getHttpServer())
      .get('/v1/memberships')
      .set('Cookie', selectedAdminCookie)
      .expect(200);

    await removeWorkspaceMembership(
      selectedAdminCookie,
      memberMembership.id,
    ).expect(204);
    const removedMembership = await prisma.membership.findUniqueOrThrow({
      where: { id: memberMembership.id },
    });
    expect(removedMembership.removedAt).toBeInstanceOf(Date);
    expect(
      await prisma.session.count({
        where: {
          userId: memberUserId,
          activeWorkspaceId: ownerWorkspaceId,
          revokedAt: { not: null },
        },
      }),
    ).toBe(2);
    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', readCookieHeader(selectedMember))
      .expect(401);
    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', readCookieHeader(secondSelectedMember))
      .expect(401);
    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', memberHomeCookie)
      .expect(200);

    await createInvitation(
      ownerCookie,
      'membership-admin-member@example.com',
      'MEMBER',
    ).expect(201);
    await acceptInvitation(
      memberHomeCookie,
      readInvitationToken('membership-admin-member@example.com'),
    ).expect(204);
    expect(
      await prisma.membership.findUniqueOrThrow({
        where: { id: memberMembership.id },
      }),
    ).toMatchObject({ removedAt: null, role: 'MEMBER' });
    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', readCookieHeader(selectedMember))
      .expect(401);
    await login(
      'membership-admin-member@example.com',
      'A secure passphrase 123',
      ownerWorkspaceId,
    ).then((response) => expect(response.status).toBe(201));
  });

  it('updates the actor profile and lets only OWNER or ADMIN rename the active workspace', async () => {
    const owner = await register('lifecycle-owner@example.com');
    const ownerCookie = readCookieHeader(owner);
    const ownerUserId = readString(owner.body as unknown, 'data', 'user', 'id');
    const workspaceId = readString(
      owner.body as unknown,
      'data',
      'workspace',
      'id',
    );

    await updateOwnProfile(ownerCookie, {
      displayName: 'Injected Name',
      userId: randomUUID(),
    }).expect(400);
    await request(app.getHttpServer())
      .patch('/v1/users/me')
      .set('Cookie', ownerCookie)
      .send({ displayName: 'Missing Origin' })
      .expect(403);
    await updateOwnProfile(ownerCookie, {
      displayName: '  Updated Owner  ',
    })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          data: { id: ownerUserId, displayName: 'Updated Owner' },
          meta: {},
        });
      });
    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', ownerCookie)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          data: { user: { id: ownerUserId, displayName: 'Updated Owner' } },
        });
      });
    expect(
      await prisma.auditLog.count({
        where: {
          workspaceId,
          actorUserId: ownerUserId,
          action: 'user.profile.updated',
        },
      }),
    ).toBe(1);

    await renameCurrentWorkspace(ownerCookie, {
      name: 'Injected Workspace',
      workspaceId: randomUUID(),
    }).expect(400);
    await renameCurrentWorkspace(ownerCookie, {
      name: '  Renamed Workspace  ',
    })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          data: { id: workspaceId, name: 'Renamed Workspace' },
          meta: {},
        });
      });
    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', ownerCookie)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          data: { workspace: { id: workspaceId, name: 'Renamed Workspace' } },
        });
      });

    const collaborator = await register('lifecycle-collaborator@example.com');
    const collaboratorHomeCookie = readCookieHeader(collaborator);
    const collaboratorUserId = readString(
      collaborator.body as unknown,
      'data',
      'user',
      'id',
    );
    await createInvitation(
      ownerCookie,
      'lifecycle-collaborator@example.com',
      'MEMBER',
    ).expect(201);
    await acceptInvitation(
      collaboratorHomeCookie,
      readInvitationToken('lifecycle-collaborator@example.com'),
    ).expect(204);
    const collaboratorSession = await login(
      'lifecycle-collaborator@example.com',
      'A secure passphrase 123',
      workspaceId,
    );
    const collaboratorCookie = readCookieHeader(collaboratorSession);
    await renameCurrentWorkspace(collaboratorCookie, {
      name: 'Member Rename',
    }).expect(403);
    const collaboratorMembership = await prisma.membership.findUniqueOrThrow({
      where: {
        workspaceId_userId: { workspaceId, userId: collaboratorUserId },
      },
    });
    await changeMembershipRole(
      ownerCookie,
      collaboratorMembership.id,
      'ADMIN',
    ).expect(204);
    await renameCurrentWorkspace(collaboratorCookie, {
      name: 'Admin Rename',
    }).expect(200);
    expect(
      await prisma.auditLog.count({
        where: { workspaceId, action: 'workspace.renamed' },
      }),
    ).toBe(2);

    await updateOwnProfile(collaboratorCookie, {
      displayName: 'Updated Collaborator',
    }).expect(200);
    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', collaboratorHomeCookie)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          data: { user: { displayName: 'Updated Collaborator' } },
        });
      });
  });

  it('leaves only the active workspace, revokes its sessions, and clears the presented cookie', async () => {
    const owner = await register('leave-owner@example.com');
    const ownerCookie = readCookieHeader(owner);
    const workspaceId = readString(
      owner.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const member = await register('leave-member@example.com');
    const memberHomeCookie = readCookieHeader(member);
    const memberUserId = readString(
      member.body as unknown,
      'data',
      'user',
      'id',
    );
    await createInvitation(
      ownerCookie,
      'leave-member@example.com',
      'MEMBER',
    ).expect(201);
    await acceptInvitation(
      memberHomeCookie,
      readInvitationToken('leave-member@example.com'),
    ).expect(204);
    const firstSelected = await login(
      'leave-member@example.com',
      'A secure passphrase 123',
      workspaceId,
    );
    const secondSelected = await login(
      'leave-member@example.com',
      'A secure passphrase 123',
      workspaceId,
    );
    const firstSelectedCookie = readCookieHeader(firstSelected);
    const secondSelectedCookie = readCookieHeader(secondSelected);

    await request(app.getHttpServer())
      .delete('/v1/memberships/me')
      .set('Cookie', firstSelectedCookie)
      .expect(403);
    await request(app.getHttpServer())
      .delete('/v1/memberships/me')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', firstSelectedCookie)
      .send({ workspaceId: randomUUID() })
      .expect(400);
    const removeCachedSession = jest
      .spyOn(sessionCache, 'remove')
      .mockRejectedValue(new Error('forced'));
    const leaveResponse = await leaveCurrentWorkspace(firstSelectedCookie);
    expect(leaveResponse.status).toBe(204);
    expect(removeCachedSession).toHaveBeenCalled();
    expect(readSetCookie(leaveResponse)).toContain('Max-Age=0');
    const leftMembership = await prisma.membership.findUniqueOrThrow({
      where: { workspaceId_userId: { workspaceId, userId: memberUserId } },
    });
    expect(leftMembership.removedAt).toBeInstanceOf(Date);
    expect(
      await prisma.session.count({
        where: {
          userId: memberUserId,
          activeWorkspaceId: workspaceId,
          revokedAt: { not: null },
        },
      }),
    ).toBe(2);
    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', firstSelectedCookie)
      .expect(401);
    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', secondSelectedCookie)
      .expect(401);
    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', memberHomeCookie)
      .expect(200);
    expect(
      await prisma.auditLog.count({
        where: {
          workspaceId,
          actorUserId: memberUserId,
          action: 'membership.left',
        },
      }),
    ).toBe(1);

    await leaveCurrentWorkspace(ownerCookie)
      .expect(409)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          error: { code: 'MEMBERSHIP_OWNERSHIP_PROTECTED' },
        });
      });
  });

  it('keeps one active membership when the final two workspace leaves race', async () => {
    const actor = await register('leave-race-actor@example.com');
    const actorCookie = readCookieHeader(actor);
    const actorUserId = readString(actor.body as unknown, 'data', 'user', 'id');
    const actorWorkspaceId = readString(
      actor.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const successor = await register('leave-race-successor@example.com');
    const successorCookie = readCookieHeader(successor);
    const successorUserId = readString(
      successor.body as unknown,
      'data',
      'user',
      'id',
    );
    await createInvitation(
      actorCookie,
      'leave-race-successor@example.com',
      'MEMBER',
    ).expect(201);
    await acceptInvitation(
      successorCookie,
      readInvitationToken('leave-race-successor@example.com'),
    ).expect(204);
    const successorMembership = await prisma.membership.findUniqueOrThrow({
      where: {
        workspaceId_userId: {
          workspaceId: actorWorkspaceId,
          userId: successorUserId,
        },
      },
    });
    await transferWorkspaceOwner(
      actorCookie,
      successorMembership.id,
      'A secure passphrase 123',
    ).expect(204);

    const secondOwner = await register('leave-race-owner@example.com');
    const secondOwnerCookie = readCookieHeader(secondOwner);
    const secondWorkspaceId = readString(
      secondOwner.body as unknown,
      'data',
      'workspace',
      'id',
    );
    await createInvitation(
      secondOwnerCookie,
      'leave-race-actor@example.com',
      'MEMBER',
    ).expect(201);
    await acceptInvitation(
      actorCookie,
      readInvitationToken('leave-race-actor@example.com'),
    ).expect(204);
    const secondWorkspaceSession = await login(
      'leave-race-actor@example.com',
      'A secure passphrase 123',
      secondWorkspaceId,
    );

    const responses = await Promise.all([
      leaveCurrentWorkspace(actorCookie),
      leaveCurrentWorkspace(readCookieHeader(secondWorkspaceSession)),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([204, 409]);
    const activeMemberships = await prisma.membership.findMany({
      where: { userId: actorUserId, removedAt: null },
    });
    expect(activeMemberships).toHaveLength(1);
    expect(
      await prisma.auditLog.count({
        where: { actorUserId, action: 'membership.left' },
      }),
    ).toBe(1);
  });

  it('rolls back lifecycle mutations when audit persistence fails', async () => {
    const owner = await register('lifecycle-audit-owner@example.com');
    const ownerCookie = readCookieHeader(owner);
    const ownerUserId = readString(owner.body as unknown, 'data', 'user', 'id');
    const workspaceId = readString(
      owner.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const appendAudit = jest.spyOn(auditLog, 'append');

    appendAudit.mockRejectedValueOnce(
      new Error('forced profile audit failure'),
    );
    await updateOwnProfile(ownerCookie, { displayName: 'Must Roll Back' })
      .expect(503)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          error: { code: 'USER_LIFECYCLE_UNAVAILABLE' },
        });
      });
    expect(
      await prisma.user.findUniqueOrThrow({ where: { id: ownerUserId } }),
    ).toMatchObject({ displayName: 'Owner' });

    appendAudit.mockRejectedValueOnce(
      new Error('forced workspace audit failure'),
    );
    await renameCurrentWorkspace(ownerCookie, { name: 'Must Roll Back' })
      .expect(503)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          error: { code: 'WORKSPACE_LIFECYCLE_UNAVAILABLE' },
        });
      });
    expect(
      await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } }),
    ).toMatchObject({ name: 'Main Workspace' });

    const member = await register('lifecycle-audit-member@example.com');
    const memberCookie = readCookieHeader(member);
    const memberUserId = readString(
      member.body as unknown,
      'data',
      'user',
      'id',
    );
    await createInvitation(
      ownerCookie,
      'lifecycle-audit-member@example.com',
      'MEMBER',
    ).expect(201);
    await acceptInvitation(
      memberCookie,
      readInvitationToken('lifecycle-audit-member@example.com'),
    ).expect(204);
    const selectedMember = await login(
      'lifecycle-audit-member@example.com',
      'A secure passphrase 123',
      workspaceId,
    );
    const selectedMemberCookie = readCookieHeader(selectedMember);
    appendAudit.mockRejectedValueOnce(new Error('forced leave audit failure'));
    await leaveCurrentWorkspace(selectedMemberCookie)
      .expect(503)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          error: { code: 'MEMBERSHIP_ADMINISTRATION_UNAVAILABLE' },
        });
      });
    expect(
      await prisma.membership.findUniqueOrThrow({
        where: { workspaceId_userId: { workspaceId, userId: memberUserId } },
      }),
    ).toMatchObject({ removedAt: null });
    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', selectedMemberCookie)
      .expect(200);
  });

  it('transfers workspace ownership only with step-up confirmation and preserves commercial ownership', async () => {
    const ownershipPassword = '\u{1F510}'.repeat(65);
    const owner = await registerWithPassword(
      'ownership-owner@example.com',
      ownershipPassword,
    );
    const ownerCookie = readCookieHeader(owner);
    const ownerUserId = readString(owner.body as unknown, 'data', 'user', 'id');
    const organizationId = readString(
      owner.body as unknown,
      'data',
      'organization',
      'id',
    );
    const workspaceId = readString(
      owner.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const target = await register('ownership-target@example.com');
    const targetHomeCookie = readCookieHeader(target);
    const targetUserId = readString(
      target.body as unknown,
      'data',
      'user',
      'id',
    );
    await createInvitation(
      ownerCookie,
      'ownership-target@example.com',
      'ADMIN',
    ).expect(201);
    await acceptInvitation(
      targetHomeCookie,
      readInvitationToken('ownership-target@example.com'),
    ).expect(204);
    const targetMembership = await prisma.membership.findUniqueOrThrow({
      where: {
        workspaceId_userId: { workspaceId, userId: targetUserId },
      },
    });
    const ownerMembership = await prisma.membership.findUniqueOrThrow({
      where: {
        workspaceId_userId: { workspaceId, userId: ownerUserId },
      },
    });

    await changeMembershipRole(
      ownerCookie,
      ownerMembership.id,
      'MEMBER',
    ).expect(409);
    await removeWorkspaceMembership(ownerCookie, ownerMembership.id).expect(
      409,
    );
    jest
      .spyOn(membershipOwnershipTransferRateLimiter, 'check')
      .mockRejectedValueOnce(new Error('forced rate limiter outage'));
    await transferWorkspaceOwner(
      ownerCookie,
      targetMembership.id,
      ownershipPassword,
    ).expect(503);
    await transferWorkspaceOwner(
      ownerCookie,
      targetMembership.id,
      'wrong password',
    ).expect(400);
    expect(
      await prisma.membership.count({
        where: { workspaceId, role: 'OWNER', removedAt: null },
      }),
    ).toBe(1);

    const selectedTarget = await login(
      'ownership-target@example.com',
      'A secure passphrase 123',
      workspaceId,
    );
    await transferWorkspaceOwner(
      ownerCookie,
      targetMembership.id,
      ownershipPassword,
    ).expect(204);

    expect(
      await prisma.membership.findUniqueOrThrow({
        where: { id: ownerMembership.id },
      }),
    ).toMatchObject({ role: 'ADMIN', removedAt: null });
    expect(
      await prisma.membership.findUniqueOrThrow({
        where: { id: targetMembership.id },
      }),
    ).toMatchObject({ role: 'OWNER', removedAt: null });
    expect(
      await prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
      }),
    ).toMatchObject({ ownerUserId });
    expect(
      await prisma.auditLog.count({
        where: {
          workspaceId,
          action: 'membership.ownership.transferred',
          resourceId: targetMembership.id,
        },
      }),
    ).toBe(1);

    await transferWorkspaceOwner(
      ownerCookie,
      targetMembership.id,
      ownershipPassword,
    ).expect(403);
    await changeMembershipRole(
      readCookieHeader(selectedTarget),
      ownerMembership.id,
      'MEMBER',
    ).expect(204);
  });

  it('returns a stable ownership-transfer rate-limit response', async () => {
    const owner = await register('ownership-rate-limit@example.com');
    jest
      .spyOn(membershipOwnershipTransferRateLimiter, 'check')
      .mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 37 });

    const response = await transferWorkspaceOwner(
      readCookieHeader(owner),
      randomUUID(),
      'A secure passphrase 123',
    );

    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toBe('37');
    expect(response.body).toMatchObject({
      error: {
        code: 'MEMBERSHIP_OWNERSHIP_TRANSFER_RATE_LIMITED',
        message: 'Too many workspace ownership transfer attempts.',
        retryable: true,
      },
    });
  });

  it('rolls back role and removal mutations when audit persistence fails', async () => {
    const owner = await register('membership-audit-owner@example.com');
    const ownerCookie = readCookieHeader(owner);
    const workspaceId = readString(
      owner.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const target = await register('membership-audit-target@example.com');
    const targetHomeCookie = readCookieHeader(target);
    const targetUserId = readString(
      target.body as unknown,
      'data',
      'user',
      'id',
    );
    await createInvitation(
      ownerCookie,
      'membership-audit-target@example.com',
      'MEMBER',
    ).expect(201);
    await acceptInvitation(
      targetHomeCookie,
      readInvitationToken('membership-audit-target@example.com'),
    ).expect(204);
    const targetMembership = await prisma.membership.findUniqueOrThrow({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });
    const selectedTarget = await login(
      'membership-audit-target@example.com',
      'A secure passphrase 123',
      workspaceId,
    );

    const appendAudit = jest.spyOn(auditLog, 'append');
    appendAudit.mockRejectedValueOnce(new Error('forced'));
    await changeMembershipRole(
      ownerCookie,
      targetMembership.id,
      'ADMIN',
    ).expect(503);
    expect(
      await prisma.membership.findUniqueOrThrow({
        where: { id: targetMembership.id },
      }),
    ).toMatchObject({ role: 'MEMBER', removedAt: null });

    appendAudit.mockRejectedValueOnce(new Error('forced'));
    await removeWorkspaceMembership(ownerCookie, targetMembership.id).expect(
      503,
    );
    expect(
      await prisma.membership.findUniqueOrThrow({
        where: { id: targetMembership.id },
      }),
    ).toMatchObject({ role: 'MEMBER', removedAt: null });
    await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', readCookieHeader(selectedTarget))
      .expect(200);
  });

  it('allows exactly one concurrent workspace ownership transfer and rolls back on audit failure', async () => {
    const owner = await register('ownership-race-owner@example.com');
    const ownerCookie = readCookieHeader(owner);
    const workspaceId = readString(
      owner.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const targetA = await register('ownership-race-a@example.com');
    const targetB = await register('ownership-race-b@example.com');
    for (const [target, email] of [
      [targetA, 'ownership-race-a@example.com'],
      [targetB, 'ownership-race-b@example.com'],
    ] as const) {
      await createInvitation(ownerCookie, email, 'ADMIN').expect(201);
      await acceptInvitation(
        readCookieHeader(target),
        readInvitationToken(email),
      ).expect(204);
    }
    const targetMemberships = await prisma.membership.findMany({
      where: { workspaceId, role: 'ADMIN', removedAt: null },
      orderBy: { id: 'asc' },
    });

    const responses = await Promise.all(
      targetMemberships.map((membership) =>
        transferWorkspaceOwner(
          ownerCookie,
          membership.id,
          'A secure passphrase 123',
        ),
      ),
    );
    expect(responses.map(({ status }) => status).sort()).toEqual([204, 403]);
    expect(
      await prisma.membership.count({
        where: { workspaceId, role: 'OWNER', removedAt: null },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { workspaceId, action: 'membership.ownership.transferred' },
      }),
    ).toBe(1);

    await clearRegistrationData(prisma);
    await redis.client.flushDb();
    const rollbackOwner = await register(
      'ownership-rollback-owner@example.com',
    );
    const rollbackTarget = await register(
      'ownership-rollback-target@example.com',
    );
    await createInvitation(
      readCookieHeader(rollbackOwner),
      'ownership-rollback-target@example.com',
      'MEMBER',
    ).expect(201);
    await acceptInvitation(
      readCookieHeader(rollbackTarget),
      readInvitationToken('ownership-rollback-target@example.com'),
    ).expect(204);
    const rollbackWorkspaceId = readString(
      rollbackOwner.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const rollbackTargetUserId = readString(
      rollbackTarget.body as unknown,
      'data',
      'user',
      'id',
    );
    const rollbackTargetMembership = await prisma.membership.findUniqueOrThrow({
      where: {
        workspaceId_userId: {
          workspaceId: rollbackWorkspaceId,
          userId: rollbackTargetUserId,
        },
      },
    });
    jest.spyOn(auditLog, 'append').mockRejectedValueOnce(new Error('forced'));
    await transferWorkspaceOwner(
      readCookieHeader(rollbackOwner),
      rollbackTargetMembership.id,
      'A secure passphrase 123',
    ).expect(503);
    expect(
      await prisma.membership.count({
        where: {
          workspaceId: rollbackWorkspaceId,
          role: 'OWNER',
          removedAt: null,
        },
      }),
    ).toBe(1);
    expect(
      await prisma.membership.findUniqueOrThrow({
        where: { id: rollbackTargetMembership.id },
      }),
    ).toMatchObject({ role: 'MEMBER' });
  });

  it('binds invitations to email, invalidates replacements, and rejects stale inviter authority', async () => {
    const owner = await register('invitation-owner@example.com');
    const ownerCookie = readCookieHeader(owner);
    const ownerUserId = readString(owner.body as unknown, 'data', 'user', 'id');
    const ownerWorkspaceId = readString(
      owner.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const invitee = await register('invitation-target@example.com');
    const inviteeCookie = readCookieHeader(invitee);
    const wrongUser = await register('invitation-wrong@example.com');
    const staleTarget = await register('invitation-stale@example.com');

    await createInvitation(
      ownerCookie,
      'invitation-target@example.com',
      'MEMBER',
    ).then((response) => expect(response.status).toBe(201));
    const oldToken = readInvitationToken('invitation-target@example.com');
    await createInvitation(
      ownerCookie,
      'invitation-target@example.com',
      'MEMBER',
    ).then((response) => expect(response.status).toBe(201));
    const replacementToken = readInvitationToken(
      'invitation-target@example.com',
      oldToken,
    );

    await acceptInvitation(inviteeCookie, oldToken).expect(400);
    await acceptInvitation(
      readCookieHeader(wrongUser),
      replacementToken,
    ).expect(400);

    const replacement = await prisma.membershipInvitation.findFirstOrThrow({
      where: { tokenHash: { not: '0'.repeat(64) }, activeKey: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
    await request(app.getHttpServer())
      .delete(`/v1/membership-invitations/${replacement.id}`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', readCookieHeader(wrongUser))
      .expect(204);
    await expect(
      prisma.membershipInvitation.findUniqueOrThrow({
        where: { id: replacement.id },
      }),
    ).resolves.toMatchObject({ revokedAt: null });

    await request(app.getHttpServer())
      .delete(`/v1/membership-invitations/${replacement.id}`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', ownerCookie)
      .expect(204);
    await acceptInvitation(inviteeCookie, replacementToken).expect(400);

    await createInvitation(
      ownerCookie,
      'invitation-stale@example.com',
      'MEMBER',
    ).then((response) => expect(response.status).toBe(201));
    const staleToken = readInvitationToken('invitation-stale@example.com');

    await prisma.membership.update({
      where: {
        workspaceId_userId: {
          workspaceId: ownerWorkspaceId,
          userId: ownerUserId,
        },
      },
      data: { role: 'MEMBER' },
    });
    await acceptInvitation(readCookieHeader(staleTarget), staleToken).expect(
      400,
    );
    expect(
      await prisma.membership.count({
        where: { workspaceId: ownerWorkspaceId },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { action: 'membership.invitation.accepted' },
      }),
    ).toBe(0);
  });

  it('allows exactly one concurrent invitation acceptance without switching the current session', async () => {
    const owner = await register('invitation-race-owner@example.com');
    const ownerWorkspaceId = readString(
      owner.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const invitee = await register('invitation-race-target@example.com');
    const inviteeCookie = readCookieHeader(invitee);
    const inviteeOriginalWorkspaceId = readString(
      invitee.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const inviteeUserId = readString(
      invitee.body as unknown,
      'data',
      'user',
      'id',
    );

    await createInvitation(
      readCookieHeader(owner),
      'invitation-race-target@example.com',
      'MEMBER',
    ).then((response) => expect(response.status).toBe(201));
    const token = readInvitationToken('invitation-race-target@example.com');
    const responses = await Promise.all([
      acceptInvitation(inviteeCookie, token),
      acceptInvitation(inviteeCookie, token),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([204, 400]);
    expect(
      await prisma.membership.count({
        where: { workspaceId: ownerWorkspaceId, userId: inviteeUserId },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: {
          workspaceId: ownerWorkspaceId,
          actorUserId: inviteeUserId,
          action: 'membership.invitation.accepted',
        },
      }),
    ).toBe(1);

    const current = await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', inviteeCookie)
      .expect(200);
    expect(readString(current.body as unknown, 'data', 'workspace', 'id')).toBe(
      inviteeOriginalWorkspaceId,
    );
  });

  it('allows only one concurrent invitation issue for the same workspace and email', async () => {
    const owner = await register('invitation-issue-race-owner@example.com');
    const ownerCookie = readCookieHeader(owner);

    const responses = await Promise.all([
      createInvitation(
        ownerCookie,
        'invitation-issue-race-target@example.com',
        'MEMBER',
      ),
      createInvitation(
        ownerCookie,
        'invitation-issue-race-target@example.com',
        'MEMBER',
      ),
    ]);

    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(invitationDeliveries).toHaveLength(1);
    expect(
      await prisma.membershipInvitation.count({
        where: { activeKey: { not: null } },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { action: 'membership.invitation.created' },
      }),
    ).toBe(1);
  });

  it('keeps a committed invitation when email delivery fails', async () => {
    const owner = await register('invitation-delivery-owner@example.com');
    jest
      .spyOn(recordingMembershipInvitationSender, 'send')
      .mockRejectedValueOnce(new Error('forced invitation delivery failure'));

    const response = await createInvitation(
      readCookieHeader(owner),
      'invitation-delivery-target@example.com',
      'MEMBER',
    );

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      meta: { invitationEmailSent: false },
    });
    const persisted = await prisma.membershipInvitation.findFirstOrThrow({
      where: { normalizedEmail: 'invitation-delivery-target@example.com' },
    });
    expect(persisted.deliveryStatus).toBe('FAILED');
    expect(typeof persisted.activeKey).toBe('string');
  });

  it('scopes invitation terminal and delivery writes to the trusted workspace', async () => {
    const owner = await register('invitation-scope-owner@example.com');
    await createInvitation(
      readCookieHeader(owner),
      'invitation-scope-target@example.com',
      'MEMBER',
    ).then((response) => expect(response.status).toBe(201));
    const invitation = await prisma.membershipInvitation.findFirstOrThrow({
      where: { normalizedEmail: 'invitation-scope-target@example.com' },
    });
    const repository = app.get(PrismaMembershipInvitationsRepository);

    await expect(
      repository.accept(randomUUID(), invitation.id, randomUUID(), new Date()),
    ).resolves.toBe(false);
    await repository.markDelivery(
      randomUUID(),
      invitation.id,
      'FAILED',
      new Date(),
    );

    await expect(
      prisma.membershipInvitation.findUniqueOrThrow({
        where: { id: invitation.id },
      }),
    ).resolves.toMatchObject({
      acceptedAt: null,
      acceptedByUserId: null,
      deliveryStatus: 'SENT',
    });
  });

  it('rejects expired invitations without membership, audit, or session changes', async () => {
    const owner = await register('invitation-expiry-owner@example.com');
    const ownerWorkspaceId = readString(
      owner.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const target = await register('invitation-expiry-target@example.com');
    const targetCookie = readCookieHeader(target);
    const targetUserId = readString(
      target.body as unknown,
      'data',
      'user',
      'id',
    );
    const targetWorkspaceId = readString(
      target.body as unknown,
      'data',
      'workspace',
      'id',
    );
    await createInvitation(
      readCookieHeader(owner),
      'invitation-expiry-target@example.com',
      'MEMBER',
    ).then((response) => expect(response.status).toBe(201));
    const token = readInvitationToken('invitation-expiry-target@example.com');
    await prisma.membershipInvitation.updateMany({
      where: { normalizedEmail: 'invitation-expiry-target@example.com' },
      data: { expiresAt: new Date('2000-01-01T00:00:00.000Z') },
    });

    await acceptInvitation(targetCookie, token).expect(400);
    expect(
      await prisma.membership.count({
        where: { workspaceId: ownerWorkspaceId, userId: targetUserId },
      }),
    ).toBe(0);
    expect(
      await prisma.auditLog.count({
        where: { action: 'membership.invitation.accepted' },
      }),
    ).toBe(0);
    const current = await request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', targetCookie)
      .expect(200);
    expect(readString(current.body as unknown, 'data', 'workspace', 'id')).toBe(
      targetWorkspaceId,
    );
  });

  it('prevents an ADMIN from replacing an OWNER-issued ADMIN invitation', async () => {
    const owner = await register('invitation-grant-owner@example.com');
    const ownerCookie = readCookieHeader(owner);
    const ownerWorkspaceId = readString(
      owner.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const admin = await register('invitation-grant-admin@example.com');
    const adminUserId = readString(admin.body as unknown, 'data', 'user', 'id');
    await prisma.membership.create({
      data: {
        id: randomUUID(),
        workspaceId: ownerWorkspaceId,
        userId: adminUserId,
        role: 'ADMIN',
      },
    });
    const selectedAdmin = await login(
      'invitation-grant-admin@example.com',
      'A secure passphrase 123',
      ownerWorkspaceId,
    );
    const target = await register('invitation-grant-target@example.com');

    await createInvitation(
      ownerCookie,
      'invitation-grant-target@example.com',
      'ADMIN',
    ).then((response) => expect(response.status).toBe(201));
    const ownerToken = readInvitationToken(
      'invitation-grant-target@example.com',
    );
    await createInvitation(
      readCookieHeader(selectedAdmin),
      'invitation-grant-target@example.com',
      'MEMBER',
    ).then((response) => expect(response.status).toBe(403));

    await acceptInvitation(readCookieHeader(target), ownerToken).expect(204);
    const targetUserId = readString(
      target.body as unknown,
      'data',
      'user',
      'id',
    );
    await expect(
      prisma.membership.findUniqueOrThrow({
        where: {
          workspaceId_userId: {
            workspaceId: ownerWorkspaceId,
            userId: targetUserId,
          },
        },
      }),
    ).resolves.toMatchObject({ role: 'ADMIN' });
  });

  it('rolls back invitation create, accept, and revoke when audit persistence fails', async () => {
    const owner = await register('invitation-audit-owner@example.com');
    const ownerCookie = readCookieHeader(owner);
    const ownerWorkspaceId = readString(
      owner.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const target = await register('invitation-audit-target@example.com');
    const targetCookie = readCookieHeader(target);
    const targetUserId = readString(
      target.body as unknown,
      'data',
      'user',
      'id',
    );
    const append = jest.spyOn(auditLog, 'append');

    append.mockRejectedValueOnce(new Error('forced create audit failure'));
    await createInvitation(
      ownerCookie,
      'invitation-create-audit@example.com',
      'MEMBER',
    ).then((response) => expect(response.status).toBe(503));
    expect(await prisma.membershipInvitation.count()).toBe(0);
    expect(invitationDeliveries).toHaveLength(0);

    await createInvitation(
      ownerCookie,
      'invitation-audit-target@example.com',
      'MEMBER',
    ).then((response) => expect(response.status).toBe(201));
    const token = readInvitationToken('invitation-audit-target@example.com');
    const invitation = await prisma.membershipInvitation.findFirstOrThrow({
      where: { workspaceId: ownerWorkspaceId, activeKey: { not: null } },
    });

    append.mockRejectedValueOnce(new Error('forced accept audit failure'));
    await acceptInvitation(targetCookie, token).expect(503);
    await expect(
      prisma.membershipInvitation.findUniqueOrThrow({
        where: { id: invitation.id },
      }),
    ).resolves.toMatchObject({ acceptedAt: null, acceptedByUserId: null });
    expect(
      await prisma.membership.count({
        where: { workspaceId: ownerWorkspaceId, userId: targetUserId },
      }),
    ).toBe(0);

    append.mockRejectedValueOnce(new Error('forced revoke audit failure'));
    await request(app.getHttpServer())
      .delete(`/v1/membership-invitations/${invitation.id}`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', ownerCookie)
      .expect(503);
    const revokeRolledBack =
      await prisma.membershipInvitation.findUniqueOrThrow({
        where: { id: invitation.id },
      });
    expect(revokeRolledBack.revokedAt).toBeNull();
    expect(typeof revokeRolledBack.activeKey).toBe('string');
  });

  it('rate-limits invitation creation and acceptance and fails closed when Redis is unavailable', async () => {
    const owner = await register('invitation-limit-owner@example.com');
    const ownerCookie = readCookieHeader(owner);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await createInvitation(
        ownerCookie,
        'invitation-limit-target@example.com',
        'MEMBER',
      ).then((response) => expect(response.status).toBe(201));
    }
    const limitedCreate = await createInvitation(
      ownerCookie,
      'invitation-limit-target@example.com',
      'MEMBER',
    );
    expect(limitedCreate.status).toBe(429);
    expect(readString(limitedCreate.body as unknown, 'error', 'code')).toBe(
      'MEMBERSHIP_INVITATION_RATE_LIMITED',
    );
    expect(limitedCreate.headers['retry-after']).toBeDefined();
    expect(invitationDeliveries).toHaveLength(5);
    expect(await prisma.membershipInvitation.count()).toBe(5);
    expect(
      await prisma.auditLog.count({
        where: { action: 'membership.invitation.created' },
      }),
    ).toBe(5);

    const target = await register('invitation-limit-accept@example.com');
    const targetCookie = readCookieHeader(target);
    await createInvitation(
      ownerCookie,
      'invitation-limit-accept@example.com',
      'MEMBER',
    ).then((response) => expect(response.status).toBe(201));
    const validToken = readInvitationToken(
      'invitation-limit-accept@example.com',
    );
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await acceptInvitation(targetCookie, 'A'.repeat(43)).expect(400);
    }
    const limitedAccept = await acceptInvitation(targetCookie, 'A'.repeat(43));
    expect(limitedAccept.status).toBe(429);
    expect(readString(limitedAccept.body as unknown, 'error', 'code')).toBe(
      'MEMBERSHIP_INVITATION_RATE_LIMITED',
    );
    expect(limitedAccept.headers['retry-after']).toBeDefined();
    expect(
      await prisma.auditLog.count({
        where: { action: 'membership.invitation.accepted' },
      }),
    ).toBe(0);

    const invitationBeforeAcceptFailure =
      await prisma.membershipInvitation.findFirstOrThrow({
        where: { normalizedEmail: 'invitation-limit-accept@example.com' },
      });
    const membershipsBeforeAcceptFailure = await prisma.membership.count();
    const auditsBeforeAcceptFailure = await prisma.auditLog.count();
    jest
      .spyOn(membershipInvitationRateLimiter, 'checkAccept')
      .mockRejectedValueOnce(new Error('forced Redis failure'));
    await acceptInvitation(targetCookie, validToken).expect(503);
    await expect(
      prisma.membershipInvitation.findUniqueOrThrow({
        where: { id: invitationBeforeAcceptFailure.id },
      }),
    ).resolves.toMatchObject({ acceptedAt: null, acceptedByUserId: null });
    expect(await prisma.membership.count()).toBe(
      membershipsBeforeAcceptFailure,
    );
    expect(await prisma.auditLog.count()).toBe(auditsBeforeAcceptFailure);

    const invitationsBeforeFailure = await prisma.membershipInvitation.count();
    const deliveriesBeforeFailure = invitationDeliveries.length;
    const auditsBeforeFailure = await prisma.auditLog.count();
    jest
      .spyOn(membershipInvitationRateLimiter, 'checkCreate')
      .mockRejectedValueOnce(new Error('forced Redis failure'));
    await createInvitation(
      ownerCookie,
      'invitation-limit-redis@example.com',
      'MEMBER',
    ).then((response) => expect(response.status).toBe(503));
    expect(await prisma.membershipInvitation.count()).toBe(
      invitationsBeforeFailure,
    );
    expect(await prisma.auditLog.count()).toBe(auditsBeforeFailure);
    expect(invitationDeliveries).toHaveLength(deliveriesBeforeFailure);
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

  function login(
    email: string,
    password = 'A secure passphrase 123',
    workspaceId?: string,
  ) {
    return request(app.getHttpServer())
      .post('/v1/auth/sessions')
      .set('Origin', ALLOWED_ORIGIN)
      .send(loginBody(email, password, workspaceId));
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

  function switchWorkspace(cookie: string, workspaceId: string) {
    return request(app.getHttpServer())
      .put('/v1/auth/session/workspace')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', cookie)
      .send({ workspaceId });
  }

  function updateOwnProfile(
    cookie: string,
    body: { displayName: string; userId?: string },
  ) {
    return request(app.getHttpServer())
      .patch('/v1/users/me')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', cookie)
      .send(body);
  }

  function renameCurrentWorkspace(
    cookie: string,
    body: { name: string; workspaceId?: string },
  ) {
    return request(app.getHttpServer())
      .patch('/v1/workspaces/current')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', cookie)
      .send(body);
  }

  function leaveCurrentWorkspace(cookie: string) {
    return request(app.getHttpServer())
      .delete('/v1/memberships/me')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', cookie);
  }

  function createInvitation(
    cookie: string,
    email: string,
    role: 'ADMIN' | 'MEMBER',
  ) {
    return request(app.getHttpServer())
      .post('/v1/membership-invitations')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', cookie)
      .send({ email, role });
  }

  function acceptInvitation(cookie: string, token: string) {
    return request(app.getHttpServer())
      .post('/v1/membership-invitations/acceptances')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', cookie)
      .send({ token });
  }

  function changeMembershipRole(
    cookie: string,
    membershipId: string,
    role: 'ADMIN' | 'MEMBER',
  ) {
    return request(app.getHttpServer())
      .patch(`/v1/memberships/${membershipId}/role`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', cookie)
      .send({ role });
  }

  function removeWorkspaceMembership(cookie: string, membershipId: string) {
    return request(app.getHttpServer())
      .delete(`/v1/memberships/${membershipId}`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', cookie);
  }

  function transferWorkspaceOwner(
    cookie: string,
    membershipId: string,
    currentPassword: string,
  ) {
    return request(app.getHttpServer())
      .put('/v1/memberships/owner')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', cookie)
      .send({ membershipId, currentPassword });
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

function loginBody(
  email: string,
  password = 'A secure passphrase 123',
  workspaceId?: string,
) {
  return workspaceId ? { email, password, workspaceId } : { email, password };
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
  await prisma.membershipInvitation.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
  await prisma.passwordCredential.deleteMany();
  await prisma.identity.deleteMany();
}

async function createWorkspaceMembership(
  prisma: PrismaService,
  userId: string,
  organizationName: string,
  workspaceName: string,
  role: 'OWNER' | 'ADMIN' | 'MEMBER' = 'OWNER',
): Promise<{ organizationId: string; workspaceId: string }> {
  const organizationId = randomUUID();
  const workspaceId = randomUUID();
  await prisma.organization.create({
    data: { id: organizationId, ownerUserId: userId, name: organizationName },
  });
  await prisma.workspace.create({
    data: { id: workspaceId, organizationId, name: workspaceName },
  });
  await prisma.membership.create({
    data: { id: randomUUID(), workspaceId, userId, role },
  });
  return { organizationId, workspaceId };
}

function readInvitationToken(email: string, excludedToken?: string): string {
  const normalizedEmail = email.trim().toLocaleLowerCase('en-US');
  for (const delivery of [...invitationDeliveries].reverse()) {
    if (
      delivery.to.toLowerCase() === normalizedEmail &&
      delivery.token !== excludedToken
    ) {
      return delivery.token;
    }
  }
  throw new Error(
    `Membership invitation was not delivered to ${normalizedEmail}.`,
  );
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

function readArray(value: unknown, ...path: string[]): unknown[] {
  let current = value;

  for (const key of path) {
    if (typeof current !== 'object' || current === null || !(key in current)) {
      throw new Error(`Expected response path: ${path.join('.')}`);
    }
    current = current[key as keyof typeof current];
  }

  if (!Array.isArray(current)) {
    throw new Error(`Expected array response path: ${path.join('.')}`);
  }
  return current;
}

function hasPath(value: unknown, ...path: string[]): boolean {
  let current = value;
  for (const key of path) {
    if (typeof current !== 'object' || current === null || !(key in current)) {
      return false;
    }
    current = current[key as keyof typeof current];
  }
  return true;
}
