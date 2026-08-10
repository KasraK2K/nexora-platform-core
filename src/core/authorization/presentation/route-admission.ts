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
