import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { createAuthenticatedRequestContext } from '../../authentication/application/authenticated-request-context';
import type { ResolvedAuthenticatedRequest } from '../../authentication/application/get-current-session.use-case';
import { attachAuthenticatedRequestContext } from '../../authentication/presentation/authenticated-request-context';
import { AuthenticatedRequestContextGuard } from '../../authentication/presentation/authenticated-request-context.guard';
import { TrustedOriginGuard } from '../../authentication/presentation/trusted-origin.guard';
import {
  EmailVerificationRequiredError,
  RouteAccessDeniedError,
} from '../domain/route-admission.errors';
import { AuthorizationPolicy } from '../application/authorization-policy';
import { AuthorizationDeniedError } from '../application/authorization-denied.error';
import {
  ApplicationAuthenticatedRoute,
  AuthenticatedRoute,
  PublicRoute,
  RouteAdmission,
} from './route-admission';
import { RouteAdmissionGuard } from './route-admission.guard';

@RouteAdmission(
  Object.freeze({ access: 'public', requireTrustedOrigin: false }),
)
class RouteAdmissionExamples {
  @PublicRoute({ requireTrustedOrigin: true })
  publicMutation(): void {}

  @AuthenticatedRoute()
  activeOnly(): void {}

  @AuthenticatedRoute({ allowPendingVerification: true })
  pendingAllowed(): void {}

  @AuthenticatedRoute({ permission: 'membership-invitation:create' })
  invitationCreate(): void {}

  @AuthenticatedRoute({
    allowPendingVerification: true,
    permission: 'membership-invitation:create',
  })
  malformedPendingPermission(): void {}

  @ApplicationAuthenticatedRoute({ requireTrustedOrigin: true })
  applicationAuthenticated(): void {}

  unclassified(): void {}
}

describe('RouteAdmissionGuard', () => {
  const active = authenticatedRequest('ACTIVE');
  const pending = authenticatedRequest('PENDING_VERIFICATION');

  it('fails closed when a handler has no policy even if its class is public', async () => {
    const fixture = createFixture('unclassified', active);

    await expect(fixture.guard.canActivate(fixture.context)).rejects.toThrow(
      RouteAccessDeniedError,
    );
    expect(fixture.trustedOrigin.canActivate).not.toHaveBeenCalled();
    expect(fixture.authenticatedRequest.canActivate).not.toHaveBeenCalled();
    expect(fixture.response.setHeader).toHaveBeenCalledWith(
      'cache-control',
      'no-store',
    );
  });

  it('enforces trusted origin before allowing a public mutation', async () => {
    const fixture = createFixture('publicMutation', active);

    await expect(fixture.guard.canActivate(fixture.context)).resolves.toBe(
      true,
    );
    expect(fixture.trustedOrigin.canActivate).toHaveBeenCalledWith(
      fixture.context,
    );
    expect(fixture.authenticatedRequest.canActivate).not.toHaveBeenCalled();
  });

  it.each([
    ['synchronous', false],
    ['asynchronous', Promise.resolve(false)],
  ])('honors a %s trusted-origin denial', async (_kind, denial) => {
    const fixture = createFixture('publicMutation', active);
    fixture.trustedOrigin.canActivate.mockReturnValueOnce(denial);

    await expect(fixture.guard.canActivate(fixture.context)).rejects.toThrow(
      RouteAccessDeniedError,
    );
    expect(fixture.authenticatedRequest.canActivate).not.toHaveBeenCalled();
  });

  it('admits an active authenticated request and attaches its context', async () => {
    const fixture = createFixture('activeOnly', active);

    await expect(fixture.guard.canActivate(fixture.context)).resolves.toBe(
      true,
    );
    expect(fixture.authenticatedRequest.canActivate).toHaveBeenCalledWith(
      fixture.context,
    );
  });

  it('honors an authenticated-context guard denial', async () => {
    const fixture = createFixture('activeOnly', active);
    fixture.authenticatedRequest.canActivate.mockResolvedValueOnce(false);

    await expect(fixture.guard.canActivate(fixture.context)).rejects.toThrow(
      RouteAccessDeniedError,
    );
  });

  it('rejects a pending user from an active-only route', async () => {
    const fixture = createFixture('activeOnly', pending);

    await expect(fixture.guard.canActivate(fixture.context)).rejects.toThrow(
      EmailVerificationRequiredError,
    );
  });

  it('admits a pending user only when the route explicitly opts in', async () => {
    const fixture = createFixture('pendingAllowed', pending);

    await expect(fixture.guard.canActivate(fixture.context)).resolves.toBe(
      true,
    );
  });

  it('enforces a declared permission from the authoritative current membership', async () => {
    const admin = createFixture(
      'invitationCreate',
      authenticatedRequest('ACTIVE', 'ADMIN'),
    );
    await expect(admin.guard.canActivate(admin.context)).resolves.toBe(true);

    const member = createFixture(
      'invitationCreate',
      authenticatedRequest('ACTIVE', 'MEMBER'),
    );
    await expect(member.guard.canActivate(member.context)).rejects.toThrow(
      AuthorizationDeniedError,
    );
  });

  it('fails closed when pending admission is combined with a permission', async () => {
    const fixture = createFixture(
      'malformedPendingPermission',
      authenticatedRequest('PENDING_VERIFICATION', 'OWNER'),
    );

    await expect(fixture.guard.canActivate(fixture.context)).rejects.toThrow(
      RouteAccessDeniedError,
    );
    expect(fixture.authenticatedRequest.canActivate).not.toHaveBeenCalled();
  });

  it('fails closed for an unknown future account status', async () => {
    const fixture = createFixture('pendingAllowed', unknownStatusRequest());

    await expect(fixture.guard.canActivate(fixture.context)).rejects.toThrow(
      RouteAccessDeniedError,
    );
  });

  it('runs origin checks but leaves application-owned authentication to the use case', async () => {
    const fixture = createFixture('applicationAuthenticated', pending);

    await expect(fixture.guard.canActivate(fixture.context)).resolves.toBe(
      true,
    );
    expect(fixture.trustedOrigin.canActivate).toHaveBeenCalledWith(
      fixture.context,
    );
    expect(fixture.authenticatedRequest.canActivate).not.toHaveBeenCalled();
  });
});

function createFixture(
  method: keyof RouteAdmissionExamples,
  authenticated: ResolvedAuthenticatedRequest,
): {
  guard: RouteAdmissionGuard;
  context: ExecutionContext;
  response: { setHeader: jest.Mock };
  trustedOrigin: { canActivate: jest.Mock };
  authenticatedRequest: { canActivate: jest.Mock };
} {
  const request = {} as Request;
  const response = { setHeader: jest.fn() };
  const context = {
    getClass: () => RouteAdmissionExamples,
    getHandler: () => RouteAdmissionExamples.prototype[method],
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response as unknown as Response,
    }),
  } as unknown as ExecutionContext;
  const trustedOrigin = { canActivate: jest.fn(() => true) };
  const authenticatedRequest = {
    canActivate: jest.fn(() => {
      attachAuthenticatedRequestContext(request, authenticated);
      return Promise.resolve(true);
    }),
  };

  return {
    guard: new RouteAdmissionGuard(
      new Reflector(),
      trustedOrigin as unknown as TrustedOriginGuard,
      authenticatedRequest as unknown as AuthenticatedRequestContextGuard,
      new AuthorizationPolicy(),
    ),
    context,
    response,
    trustedOrigin,
    authenticatedRequest,
  };
}

function authenticatedRequest(
  userStatus: 'PENDING_VERIFICATION' | 'ACTIVE',
  role: 'OWNER' | 'ADMIN' | 'MEMBER' = 'OWNER',
): ResolvedAuthenticatedRequest {
  return Object.freeze({
    context: createAuthenticatedRequestContext({
      sessionId: '01911457-6ca2-7d29-8abe-12fe03ea401c',
      actorUserId: '01911457-9b3a-7cc3-9c3a-3b7508f69f5c',
      userStatus,
      organizationId: '01911457-c5b3-7eb8-9e52-c7b80b372506',
      workspaceId: '01911457-e820-7b71-b695-a07fb242b8ec',
    }),
    currentSession: Object.freeze({
      user: Object.freeze({
        id: '01911457-9b3a-7cc3-9c3a-3b7508f69f5c',
        displayName: 'Owner',
        status: userStatus,
      }),
      organization: Object.freeze({
        id: '01911457-c5b3-7eb8-9e52-c7b80b372506',
        name: 'Organization',
      }),
      workspace: Object.freeze({
        id: '01911457-e820-7b71-b695-a07fb242b8ec',
        name: 'Workspace',
      }),
      membership: Object.freeze({ role }),
    }),
  });
}

function unknownStatusRequest(): ResolvedAuthenticatedRequest {
  const authenticated = authenticatedRequest('ACTIVE');

  return Object.freeze({
    ...authenticated,
    context: Object.freeze({
      ...authenticated.context,
      userStatus: 'SUSPENDED',
    }),
  }) as unknown as ResolvedAuthenticatedRequest;
}
