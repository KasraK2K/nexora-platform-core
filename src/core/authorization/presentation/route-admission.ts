import { Reflector } from '@nestjs/core';
import type { Permission } from '../application/authorization-policy';

export type PublicRouteOptions = Readonly<{
  requireTrustedOrigin?: boolean;
}>;

export type AuthenticatedRouteOptions = Readonly<{
  allowPendingVerification?: boolean;
  requireTrustedOrigin?: boolean;
  permission?: Permission;
}>;

export type ApplicationAuthenticatedRouteOptions = Readonly<{
  requireTrustedOrigin?: boolean;
}>;

/**
 * Explicit, deny-by-default admission policy for one HTTP handler. Missing or
 * structurally invalid policy metadata is rejected by the global guard.
 */
export type RouteAdmissionPolicy = Readonly<
  | {
      access: 'public';
      requireTrustedOrigin: boolean;
    }
  | {
      access: 'authenticated';
      allowPendingVerification: boolean;
      requireTrustedOrigin: boolean;
      permission: Permission | null;
    }
  | {
      access: 'application-authenticated';
      requireTrustedOrigin: boolean;
    }
>;

export const RouteAdmission = Reflector.createDecorator<RouteAdmissionPolicy>({
  key: 'nexora:route-admission',
});

/** Declares a route that does not require an authenticated tenant context. */
export function PublicRoute(options: PublicRouteOptions = {}): MethodDecorator {
  return RouteAdmission(
    Object.freeze({
      access: 'public' as const,
      requireTrustedOrigin: options.requireTrustedOrigin ?? false,
    }),
  );
}

export function AuthenticatedRoute(
  options: AuthenticatedRouteOptions = {},
): MethodDecorator {
  return RouteAdmission(
    Object.freeze({
      access: 'authenticated' as const,
      allowPendingVerification: options.allowPendingVerification ?? false,
      requireTrustedOrigin: options.requireTrustedOrigin ?? false,
      permission: options.permission ?? null,
    }),
  );
}

/**
 * Declares that the application use case owns session validation. Reserve this
 * for credential self-service flows that cannot require a full tenant context.
 */
export function ApplicationAuthenticatedRoute(
  options: ApplicationAuthenticatedRouteOptions = {},
): MethodDecorator {
  return RouteAdmission(
    Object.freeze({
      access: 'application-authenticated' as const,
      requireTrustedOrigin: options.requireTrustedOrigin ?? false,
    }),
  );
}
