import type { ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppConfig } from '../../../config/app-config';
import { createAuthenticatedRequestContext } from '../security/authenticated-request-context';
import {
  SessionContextService,
  type ResolvedAuthenticatedRequest,
} from '../services/session-context.service';
import { AuthenticationRequiredError } from '../errors/authentication.errors';
import {
  attachAuthenticatedRequestContext,
  readAuthenticatedRequestContext,
  requireAuthenticatedRequestContext,
} from '../decorators/authenticated-request-context.decorator';
import { AuthenticatedRequestContextGuard } from './authenticated-request-context.guard';

describe('authenticated request context presentation boundary', () => {
  const authenticated = Object.freeze({
    context: createAuthenticatedRequestContext({
      sessionId: '01911457-6ca2-7d29-8abe-12fe03ea401c',
      actorUserId: '01911457-9b3a-7cc3-9c3a-3b7508f69f5c',
      userStatus: 'ACTIVE',
      organizationId: '01911457-c5b3-7eb8-9e52-c7b80b372506',
      workspaceId: '01911457-e820-7b71-b695-a07fb242b8ec',
    }),
    currentSession: Object.freeze({
      user: Object.freeze({
        id: '01911457-9b3a-7cc3-9c3a-3b7508f69f5c',
        displayName: 'Owner',
        status: 'ACTIVE',
      }),
      organization: Object.freeze({
        id: '01911457-c5b3-7eb8-9e52-c7b80b372506',
        name: 'Organization',
      }),
      workspace: Object.freeze({
        id: '01911457-e820-7b71-b695-a07fb242b8ec',
        name: 'Workspace',
      }),
      membership: Object.freeze({ role: 'OWNER' }),
    }),
  }) satisfies ResolvedAuthenticatedRequest;

  it('attaches resolved state under a private non-writable request property', () => {
    const request = {} as Request;

    attachAuthenticatedRequestContext(request, authenticated);

    expect(readAuthenticatedRequestContext(request)).toBe(authenticated);
    expect(requireAuthenticatedRequestContext(request)).toBe(authenticated);
    expect(Object.keys(request)).toEqual([]);
    const symbols = Object.getOwnPropertySymbols(request);
    expect(symbols).toHaveLength(1);
    expect(Object.getOwnPropertyDescriptor(request, symbols[0])).toMatchObject({
      configurable: false,
      enumerable: false,
      value: authenticated,
      writable: false,
    });
  });

  it('fails closed when context access occurs without the guard', () => {
    expect(() => requireAuthenticatedRequestContext({} as Request)).toThrow(
      AuthenticationRequiredError,
    );
  });

  it('resolves only the configured cookie and attaches private response headers', async () => {
    const resolveAuthenticatedRequest = jest
      .fn<Promise<ResolvedAuthenticatedRequest>, [string | undefined]>()
      .mockResolvedValue(authenticated);
    const guard = new AuthenticatedRequestContextGuard(
      {
        resolveAuthenticatedRequest,
      } as unknown as SessionContextService,
      {
        sessionCookieName: '__Host-nexora_session',
      } as AppConfig,
    );
    const request = {
      header: jest.fn((name: string) =>
        name === 'cookie'
          ? '__Host-nexora_session=opaque-token; X-Workspace-Id=attacker'
          : undefined,
      ),
    } as unknown as Request;
    const setHeader = jest.fn();
    const response = { setHeader } as unknown as Response;
    const executionContext = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(executionContext)).resolves.toBe(true);

    expect(resolveAuthenticatedRequest).toHaveBeenCalledWith('opaque-token');
    expect(readAuthenticatedRequestContext(request)).toBe(authenticated);
    expect(setHeader).toHaveBeenCalledWith('cache-control', 'no-store');
    expect(setHeader).toHaveBeenCalledWith('pragma', 'no-cache');
  });
});
