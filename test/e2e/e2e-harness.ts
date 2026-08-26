import { Test, TestingModule } from '@nestjs/testing';
import { Controller, Get, Module } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { verify } from 'argon2';
import { randomUUID } from 'node:crypto';
import request, {
  type Response as SuperTestResponse,
  type Test as SuperTestRequest,
} from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/configure-app';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { RedisService } from '../../src/infrastructure/cache/redis.service';
import { SessionCache } from '../../src/modules/authentication/cache/redis-session-cache';
import { AuditService } from '../../src/modules/audit/audit.service';
import { PASSWORD_HASHER } from '../../src/modules/authentication/security/password-hasher';
import type { PasswordHasher } from '../../src/modules/authentication/security/password-hasher';
import { PasswordCredentialsService } from '../../src/modules/identity/password-credentials.service';
import { AuthenticationRateLimiter } from '../../src/modules/authentication/rate-limit/redis-authentication-rate-limiter';
import { OpaqueTokenService } from '../../src/common/security/opaque-token.service';
import {
  OUTBOUND_MAIL,
  type OutboundMail,
} from '../../src/modules/mail/providers/outbound-mail';
import { MailOutboxRepository } from '../../src/modules/mail/repositories/mail-outbox.repository';
import { MembershipInvitationRateLimiter } from '../../src/modules/memberships/rate-limit/redis-membership-invitation-rate-limiter';
import { MembershipOwnershipTransferRateLimiter } from '../../src/modules/memberships/rate-limit/redis-membership-ownership-transfer-rate-limiter';
import { MembershipInvitationsRepository } from '../../src/modules/memberships/repositories/membership-invitations.repository';
import { MembershipsRepository } from '../../src/modules/memberships/repositories/memberships.repository';
import { AuthenticationSessionsRepository } from '../../src/modules/authentication/repositories/authentication-sessions.repository';
import { SessionStateRepository } from '../../src/modules/authentication/session-state/session-state.repository';
import { WorkspacesRepository } from '../../src/modules/workspaces/workspaces.repository';
import {
  AuthenticatedRoute,
  PublicRoute,
} from '../../src/modules/authorization/decorators/route-admission.decorator';
import { CurrentAuthenticatedContext } from '../../src/modules/authentication/decorators/authenticated-request-context.decorator';
import type { AuthenticatedRequestContext } from '../../src/modules/authentication/security/authenticated-request-context';
import { ApplicationError } from '../../src/common/errors/application-error';

const ALLOWED_ORIGIN = 'http://localhost:3000';
const verificationDeliveries: Array<{
  to: string;
  token: string;
  expiresAt: Date;
}> = [];
const recordingEmailSender = {
  send(input: { to: string; token: string; expiresAt: Date }) {
    verificationDeliveries.push(input);
    return Promise.resolve();
  },
};
const resetDeliveries: Array<{
  to: string;
  token: string;
  expiresAt: Date;
}> = [];
const recordingPasswordResetSender = {
  send(input: { to: string; token: string; expiresAt: Date }) {
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
const recordingMembershipInvitationSender = {
  send(input: {
    to: string;
    token: string;
    role: 'ADMIN' | 'MEMBER';
    expiresAt: Date;
  }) {
    invitationDeliveries.push(input);
    return Promise.resolve();
  },
};
const recordingOutboundMail: OutboundMail = {
  async send(input) {
    const token = readMailToken(input.text);
    const expiresAt = readMailExpiry(input.text);
    if (input.subject === 'Verify your email address') {
      await recordingEmailSender.send({ to: input.to, token, expiresAt });
    } else if (input.subject === 'Reset your password') {
      await recordingPasswordResetSender.send({
        to: input.to,
        token,
        expiresAt,
      });
    } else {
      await recordingMembershipInvitationSender.send({
        to: input.to,
        token,
        role: input.text.includes(' as ADMIN.') ? 'ADMIN' : 'MEMBER',
        expiresAt,
      });
    }
  },
};

function readMailToken(text: string): string {
  const match = text.match(/#token=([^\s]+)/);
  if (!match) throw new Error('Mail token missing');
  return decodeURIComponent(match[1]);
}

function readMailExpiry(text: string): Date {
  const match = text.match(/expires at ([^\s]+)\./);
  if (!match) throw new Error('Mail expiry missing');
  return new Date(match[1]);
}
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

@Module({ controllers: [RouteAdmissionProbeController] })
class RouteAdmissionProbeModule {}

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

/** Boots one independently usable API test application and its shared fixtures. */
export async function createE2eHarness() {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule, RouteAdmissionProbeModule],
  })
    .overrideProvider(OUTBOUND_MAIL)
    .useValue(recordingOutboundMail)
    .compile();

  const app = moduleFixture.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  const prisma = app.get(PrismaService);
  const redis = app.get(RedisService);
  const sessionCache = app.get(SessionCache);
  const auditLog = app.get(AuditService);
  const passwordHasher = app.get<PasswordHasher>(PASSWORD_HASHER);
  const passwordIdentities = app.get(PasswordCredentialsService);
  const passwordCredentialVerification = app.get(PasswordCredentialsService);
  const authenticationRateLimiter = app.get(AuthenticationRateLimiter);
  const membershipInvitationRateLimiter = app.get(
    MembershipInvitationRateLimiter,
  );
  const membershipOwnershipTransferRateLimiter = app.get(
    MembershipOwnershipTransferRateLimiter,
  );
  const mailOutboxRepository = app.get(MailOutboxRepository);

  async function reset(): Promise<void> {
    await clearRegistrationData(prisma);
    await redis.client.flushDb();
    verificationDeliveries.length = 0;
    resetDeliveries.length = 0;
    invitationDeliveries.length = 0;
    unclassifiedRouteExecutions = 0;
  }

  async function close(): Promise<void> {
    await app.close();
  }

  async function register(email: string): Promise<SuperTestResponse> {
    const response = await registerUnverified(email);
    if (response.status === 201) {
      await confirmEmail(await readVerificationToken(email)).expect(204);
    }
    return response;
  }

  async function registerWithPassword(
    email: string,
    password: string,
  ): Promise<SuperTestResponse> {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/registrations')
      .set('Origin', ALLOWED_ORIGIN)
      .send({ ...registrationBody(email), password });
    if (response.status === 201) {
      await confirmEmail(await readVerificationToken(email)).expect(204);
    }
    return response;
  }

  function registerUnverified(email: string): SuperTestRequest {
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

  function confirmEmail(token: string): SuperTestRequest {
    return request(app.getHttpServer())
      .post('/v1/auth/email-verifications')
      .set('Origin', ALLOWED_ORIGIN)
      .send({ token });
  }

  async function requestPasswordReset(
    email: string,
  ): Promise<SuperTestResponse> {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/password-reset-requests')
      .set('Origin', ALLOWED_ORIGIN)
      .send({ email });
    await waitForImmediateMailAttempts();
    return response;
  }

  async function waitForImmediateMailAttempts(): Promise<void> {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const pending = await prisma.mailOutboxMessage.count({
        where: { status: { in: ['PENDING', 'PROCESSING'] } },
      });
      if (pending === 0) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('Timed out waiting for immediate durable mail attempt.');
  }

  function confirmPasswordReset(
    token: string,
    newPassword: string,
  ): SuperTestRequest {
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

  function switchWorkspace(
    cookie: string,
    workspaceId: string,
  ): SuperTestRequest {
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

  function leaveCurrentWorkspace(cookie: string): SuperTestRequest {
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

  function acceptInvitation(cookie: string, token: string): SuperTestRequest {
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

  function removeWorkspaceMembership(
    cookie: string,
    membershipId: string,
  ): SuperTestRequest {
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

  function readSetCookie(response: {
    headers: Record<string, unknown>;
  }): string {
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
    await prisma.mailOutboxMessage.deleteMany();
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

  async function createMailOutboxWorkspace(
    prisma: PrismaService,
  ): Promise<string> {
    const identityId = randomUUID();
    const userId = randomUUID();
    const organizationId = randomUUID();
    const workspaceId = randomUUID();
    await prisma.identity.create({
      data: {
        id: identityId,
        normalizedEmail: `mail-outbox-${identityId}@example.test`,
      },
    });
    await prisma.user.create({
      data: {
        id: userId,
        identityId,
        displayName: 'Mail outbox repository test',
      },
    });
    await prisma.organization.create({
      data: {
        id: organizationId,
        ownerUserId: userId,
        name: 'Mail outbox repository test',
      },
    });
    await prisma.workspace.create({
      data: {
        id: workspaceId,
        organizationId,
        name: 'Mail outbox repository test',
      },
    });
    return workspaceId;
  }

  function processingMailMessage(input: {
    id: string;
    workspaceId: string;
    suffix: string;
    attemptCount?: number;
    expiresAt: Date;
    lockedUntil: Date;
  }) {
    return {
      id: input.id,
      workspaceId: input.workspaceId,
      purpose: 'EMAIL_VERIFICATION' as const,
      idempotencyKey: `EMAIL_VERIFICATION:${input.id}`,
      messageId: `<${input.id}@mail.example.test>`,
      encryptedPayload: 'encrypted-sensitive-payload',
      correlationId: input.suffix,
      status: 'PROCESSING' as const,
      attemptCount: input.attemptCount ?? 1,
      lastAttemptAt: new Date('2099-01-01T23:58:00.000Z'),
      expiresAt: input.expiresAt,
      lockedUntil: input.lockedUntil,
    };
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

  async function readVerificationToken(
    email: string,
    excludedToken?: string,
  ): Promise<string> {
    const normalizedEmail = email.trim().toLocaleLowerCase('en-US');
    for (let attempt = 0; attempt < 50; attempt += 1) {
      for (const delivery of [...verificationDeliveries].reverse()) {
        if (
          delivery.to.toLowerCase() === normalizedEmail &&
          delivery.token !== excludedToken
        ) {
          return delivery.token;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(
      `Verification email was not delivered to ${normalizedEmail}.`,
    );
  }

  function readPasswordResetToken(
    email: string,
    excludedToken?: string,
  ): string {
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
      if (
        typeof current !== 'object' ||
        current === null ||
        !(key in current)
      ) {
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
      if (
        typeof current !== 'object' ||
        current === null ||
        !(key in current)
      ) {
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
      if (
        typeof current !== 'object' ||
        current === null ||
        !(key in current)
      ) {
        return false;
      }
      current = current[key as keyof typeof current];
    }
    return true;
  }

  return {
    app,
    prisma,
    redis,
    sessionCache,
    auditLog,
    passwordHasher,
    passwordIdentities,
    passwordCredentialVerification,
    authenticationRateLimiter,
    membershipInvitationRateLimiter,
    membershipOwnershipTransferRateLimiter,
    mailOutboxRepository,
    verificationDeliveries,
    resetDeliveries,
    invitationDeliveries,
    recordingEmailSender,
    recordingPasswordResetSender,
    recordingMembershipInvitationSender,
    get unclassifiedRouteExecutions() {
      return unclassifiedRouteExecutions;
    },
    request,
    verify,
    randomUUID,
    MembershipInvitationsRepository,
    MembershipsRepository,
    AuthenticationSessionsRepository,
    SessionStateRepository,
    WorkspacesRepository,
    OpaqueTokenService,
    allowedOrigin: ALLOWED_ORIGIN,
    reset,
    close,
    register,
    registerWithPassword,
    registerUnverified,
    login,
    confirmEmail,
    requestPasswordReset,
    waitForImmediateMailAttempts,
    confirmPasswordReset,
    changePassword,
    switchWorkspace,
    updateOwnProfile,
    renameCurrentWorkspace,
    leaveCurrentWorkspace,
    createInvitation,
    acceptInvitation,
    changeMembershipRole,
    removeWorkspaceMembership,
    transferWorkspaceOwner,
    registrationBody,
    loginBody,
    readSetCookie,
    readCookieHeader,
    clearRegistrationData,
    createMailOutboxWorkspace,
    processingMailMessage,
    createWorkspaceMembership,
    readInvitationToken,
    readVerificationToken,
    readPasswordResetToken,
    readString,
    readArray,
    hasPath,
  };
}

export type E2eHarness = Awaited<ReturnType<typeof createE2eHarness>>;
