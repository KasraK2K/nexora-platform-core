import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { readAuthenticatedRequestContext } from '../../authentication/decorators/authenticated-request-context.decorator';
import { AuthenticatedRequestContextGuard } from '../../authentication/guards/authenticated-request-context.guard';
import { setPrivateResponseHeaders } from '../../../common/http/private-response-headers';
import { TrustedOriginGuard } from '../../authentication/guards/trusted-origin.guard';
import {
  EmailVerificationRequiredError,
  RouteAccessDeniedError,
} from '../errors/route-admission.errors';
import { isPermission, permits } from '../authorization.policy';
import { AuthorizationDeniedError } from '../authorization.errors';
import {
  RouteAdmission,
  type RouteAdmissionPolicy,
} from '../decorators/route-admission.decorator';

/**
 * Global deny-by-default guard for every Nest handler.
 *
 * It validates exact origin before resolving a session, rejects missing or
 * malformed admission metadata, and evaluates only the closed Core permission
 * catalog. Application-authenticated routes deliberately skip request-context
 * resolution because their use case owns durable session validation.
 */
@Injectable()
export class RouteAdmissionGuard implements CanActivate {
  private readonly logger = new Logger(RouteAdmissionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly trustedOrigin: TrustedOriginGuard,
    private readonly authenticatedRequest: AuthenticatedRequestContextGuard,
  ) {}

  /**
   * Applies declared admission in security order: metadata, trusted origin,
   * access kind, authenticated context, user status, then coarse permission.
   * Any false nested-guard result or unusable context fails closed.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.get(RouteAdmission, context.getHandler());

    if (!isRouteAdmissionPolicy(policy)) {
      setPrivateResponseHeaders(context.switchToHttp().getResponse<Response>());
      this.logger.error(
        JSON.stringify({
          event: 'http.route_admission_unclassified',
          controller: context.getClass().name,
          handler: context.getHandler().name,
        }),
      );
      throw new RouteAccessDeniedError();
    }

    if (policy.requireTrustedOrigin) {
      const originAllowed = await readGuardDecision(
        this.trustedOrigin.canActivate(context),
      );
      if (!originAllowed) {
        throw new RouteAccessDeniedError();
      }
    }

    if (policy.access !== 'authenticated') {
      return true;
    }

    const authenticatedAllowed =
      await this.authenticatedRequest.canActivate(context);
    if (!authenticatedAllowed) {
      throw new RouteAccessDeniedError();
    }
    const authenticated = readAuthenticatedRequestContext(
      context.switchToHttp().getRequest<Request>(),
    );
    if (!authenticated) {
      throw new RouteAccessDeniedError();
    }
    const { userStatus } = authenticated.context;
    if (userStatus === 'PENDING_VERIFICATION') {
      if (policy.allowPendingVerification) {
        return true;
      }

      throw new EmailVerificationRequiredError();
    }
    if (userStatus !== 'ACTIVE') {
      throw new RouteAccessDeniedError();
    }

    if (
      policy.permission &&
      !permits(authenticated.currentSession.membership.role, policy.permission)
    ) {
      throw new AuthorizationDeniedError();
    }

    return true;
  }
}

/** Preserves Nest's synchronous-or-asynchronous guard contract for composed guards. */
async function readGuardDecision(
  decision: boolean | Promise<boolean>,
): Promise<boolean> {
  return decision;
}

/** Strictly validates untrusted reflection metadata before admission uses it. */
function isRouteAdmissionPolicy(value: unknown): value is RouteAdmissionPolicy {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('access' in value) ||
    !('requireTrustedOrigin' in value) ||
    typeof value.requireTrustedOrigin !== 'boolean'
  ) {
    return false;
  }

  if (
    value.access === 'public' ||
    value.access === 'application-authenticated'
  ) {
    return Object.keys(value).length === 2;
  }

  return (
    value.access === 'authenticated' &&
    'allowPendingVerification' in value &&
    typeof value.allowPendingVerification === 'boolean' &&
    'permission' in value &&
    (value.permission === null || isPermission(value.permission)) &&
    !(value.allowPendingVerification && value.permission !== null) &&
    Object.keys(value).length === 4
  );
}
