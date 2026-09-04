import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Module,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request, {
  type Response as SuperTestResponse,
  type Test as SuperTestRequest,
} from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/configure-app';
import { ApplicationError } from '../../src/common/errors/application-error';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { RedisService } from '../../src/infrastructure/cache/redis.service';
import { CurrentAuthenticatedContext } from '../../src/modules/authentication/decorators/authenticated-request-context.decorator';
import type { AuthenticatedRequestContext } from '../../src/modules/authentication/security/authenticated-request-context';
import {
  AuthenticatedRoute,
  PublicRoute,
} from '../../src/modules/authorization/route-admission.decorator';
import { MailDeliveryService } from '../../src/modules/mail/mail-delivery.service';
import {
  OUTBOUND_MAIL,
  type OutboundMail,
} from '../../src/modules/mail/providers/outbound-mail';

const ALLOWED_ORIGIN = 'http://localhost:3000';
const DEFAULT_PASSWORD = 'A secure passphrase 123';

type RecordedDelivery = Readonly<{
  to: string;
  token: string;
  expiresAt: Date;
}>;

const verificationDeliveries: RecordedDelivery[] = [];
const resetDeliveries: RecordedDelivery[] = [];
const invitationDeliveries: RecordedDelivery[] = [];

const recordingOutboundMail: OutboundMail = {
  send(input) {
    const delivery = {
      to: input.to,
      token: readMailToken(input.text),
      expiresAt: readMailExpiry(input.text),
    };
    if (input.subject === 'Verify your email address') {
      verificationDeliveries.push(delivery);
    } else if (input.subject === 'Reset your password') {
      resetDeliveries.push(delivery);
    } else {
      invitationDeliveries.push(delivery);
    }
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

@Module({ controllers: [RouteAdmissionProbeController] })
class RouteAdmissionProbeModule {}

class UnsafeDetailsError extends HttpException {
  constructor() {
    super(
      {
        code: 'DEPENDENCY_FAILED',
        message: 'Safe public message.',
        retryable: true,
        details: { secret: 'must-not-leak', sql: 'select sensitive' },
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

class UnsafeWorkspaceSelectionDetailsError extends ApplicationError {
  readonly code = 'WORKSPACE_SELECTION_REQUIRED';
  readonly retryable = false;
  readonly details = {
    availableWorkspaces: [
      {
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
  const mailDelivery = app.get(MailDeliveryService);

  async function reset(): Promise<void> {
    await prisma.mailOutboxMessage.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.session.deleteMany();
    await prisma.emailVerification.deleteMany();
    await prisma.membershipInvitation.deleteMany();
    await prisma.membership.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();
    await redis.client.flushDb();
    verificationDeliveries.length = 0;
    resetDeliveries.length = 0;
    invitationDeliveries.length = 0;
    unclassifiedRouteExecutions = 0;
  }

  async function close(): Promise<void> {
    await app.close();
  }

  async function drainMail(): Promise<void> {
    for (let pass = 0; pass < 10; pass += 1) {
      const pending = await prisma.mailOutboxMessage.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (pending.length === 0) return;
      for (const message of pending) {
        await mailDelivery.deliverNow(message.id);
      }
    }
    throw new Error('Mail outbox did not drain.');
  }

  function registerUnverified(
    email: string,
    password = DEFAULT_PASSWORD,
  ): SuperTestRequest {
    return request(app.getHttpServer())
      .post('/v1/auth/registrations')
      .set('Origin', ALLOWED_ORIGIN)
      .send({
        email,
        password,
        displayName: 'Owner',
        workspaceName: 'Main Workspace',
      });
  }

  async function register(
    email: string,
    password = DEFAULT_PASSWORD,
  ): Promise<SuperTestResponse> {
    const response = await registerUnverified(email, password);
    if (response.status === 201) {
      await drainMail();
      await confirmEmail(
        readDeliveryToken(verificationDeliveries, email),
      ).expect(204);
    }
    return response;
  }

  function confirmEmail(token: string): SuperTestRequest {
    return request(app.getHttpServer())
      .post('/v1/auth/email-verifications')
      .set('Origin', ALLOWED_ORIGIN)
      .send({ token });
  }

  function login(
    email: string,
    password = DEFAULT_PASSWORD,
    workspaceId?: string,
  ): SuperTestRequest {
    return request(app.getHttpServer())
      .post('/v1/auth/sessions')
      .set('Origin', ALLOWED_ORIGIN)
      .send(
        workspaceId ? { email, password, workspaceId } : { email, password },
      );
  }

  function createWorkspace(cookie: string, name: string): SuperTestRequest {
    return request(app.getHttpServer())
      .post('/v1/workspaces')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', cookie)
      .send({ name });
  }

  async function createInvitation(
    cookie: string,
    email: string,
  ): Promise<SuperTestResponse> {
    const response = await request(app.getHttpServer())
      .post('/v1/membership-invitations')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', cookie)
      .send({ email });
    if (response.status === 201) await drainMail();
    return response;
  }

  function acceptInvitation(cookie: string, token: string): SuperTestRequest {
    return request(app.getHttpServer())
      .post('/v1/membership-invitations/acceptances')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', cookie)
      .send({ token });
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

  function currentSession(cookie: string): SuperTestRequest {
    return request(app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', cookie);
  }

  function requestPasswordReset(email: string): SuperTestRequest {
    return request(app.getHttpServer())
      .post('/v1/auth/password-reset-requests')
      .set('Origin', ALLOWED_ORIGIN)
      .send({ email });
  }

  function resetPassword(token: string, newPassword: string): SuperTestRequest {
    return request(app.getHttpServer())
      .post('/v1/auth/password-resets')
      .set('Origin', ALLOWED_ORIGIN)
      .send({ token, newPassword });
  }

  function changePassword(
    cookie: string,
    currentPassword: string,
    newPassword: string,
  ): SuperTestRequest {
    return request(app.getHttpServer())
      .put('/v1/auth/password')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', cookie)
      .send({ currentPassword, newPassword });
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

  return {
    app,
    prisma,
    redis,
    request,
    allowedOrigin: ALLOWED_ORIGIN,
    defaultPassword: DEFAULT_PASSWORD,
    verificationDeliveries,
    resetDeliveries,
    invitationDeliveries,
    get unclassifiedRouteExecutions() {
      return unclassifiedRouteExecutions;
    },
    reset,
    close,
    drainMail,
    registerUnverified,
    register,
    confirmEmail,
    login,
    createWorkspace,
    createInvitation,
    acceptInvitation,
    switchWorkspace,
    currentSession,
    requestPasswordReset,
    resetPassword,
    changePassword,
    readSetCookie,
    readCookieHeader,
    readString,
    readArray,
    readDeliveryToken,
  };
}

function readMailToken(text: string): string {
  const match = text.match(/#token=([^\s]+)/);
  if (!match?.[1]) throw new Error('Mail token missing.');
  return decodeURIComponent(match[1]);
}

function readMailExpiry(text: string): Date {
  const match = text.match(/expires at ([^\s]+)\./);
  if (!match?.[1]) throw new Error('Mail expiry missing.');
  return new Date(match[1]);
}

function readDeliveryToken(
  deliveries: readonly RecordedDelivery[],
  email: string,
): string {
  const normalized = email.trim().toLocaleLowerCase('en-US');
  const delivery = [...deliveries]
    .reverse()
    .find(({ to }) => to.toLocaleLowerCase('en-US') === normalized);
  if (!delivery) throw new Error(`No mail was delivered to ${normalized}.`);
  return delivery.token;
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

export type E2eHarness = Awaited<ReturnType<typeof createE2eHarness>>;
