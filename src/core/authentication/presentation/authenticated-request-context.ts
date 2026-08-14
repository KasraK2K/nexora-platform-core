import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedRequestContext } from '../application/authenticated-request-context';
import type {
  CurrentSession,
  ResolvedAuthenticatedRequest,
} from '../application/get-current-session.use-case';
import { AuthenticationRequiredError } from '../domain/registration.errors';

const AUTHENTICATED_REQUEST_CONTEXT = Symbol('AUTHENTICATED_REQUEST_CONTEXT');

type RequestWithAuthenticatedContext = Request & {
  [AUTHENTICATED_REQUEST_CONTEXT]?: ResolvedAuthenticatedRequest;
};

/**
 * Attaches server-resolved authority as a non-enumerable, immutable request
 * property so later guards and handlers cannot source it from client input.
 */
export function attachAuthenticatedRequestContext(
  request: Request,
  authenticated: ResolvedAuthenticatedRequest,
): void {
  Object.defineProperty(request, AUTHENTICATED_REQUEST_CONTEXT, {
    configurable: false,
    enumerable: false,
    value: authenticated,
    writable: false,
  });
}

/** Reads authority previously attached by the authentication context guard. */
export function readAuthenticatedRequestContext(
  request: Request,
): ResolvedAuthenticatedRequest | undefined {
  return (request as RequestWithAuthenticatedContext)[
    AUTHENTICATED_REQUEST_CONTEXT
  ];
}

/** Injects the immutable authenticated actor and workspace authority into a handler. */
export const CurrentAuthenticatedContext = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedRequestContext =>
    requireAuthenticatedRequestContext(
      context.switchToHttp().getRequest<Request>(),
    ).context,
);

/** Injects the public current-session view into a handler. */
export const CurrentAuthenticatedSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentSession =>
    requireAuthenticatedRequestContext(
      context.switchToHttp().getRequest<Request>(),
    ).currentSession,
);

/** Returns attached authority or fails closed when the guard did not establish it. */
export function requireAuthenticatedRequestContext(
  request: Request,
): ResolvedAuthenticatedRequest {
  const authenticated = readAuthenticatedRequestContext(request);
  if (!authenticated) {
    throw new AuthenticationRequiredError();
  }
  return authenticated;
}
