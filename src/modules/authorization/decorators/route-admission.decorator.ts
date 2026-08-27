import { Reflector } from '@nestjs/core';
import type { Permission } from '../authorization.policy';

/** Options for an explicitly unauthenticated handler. */
export type PublicRouteOptions = Readonly<{
  requireTrustedOrigin?: boolean;
}>;

/** Options for a handler admitted from server-resolved session context. */
export type AuthenticatedRouteOptions = Readonly<{
  allowPendingVerification?: boolean;
  requireTrustedOrigin?: boolean;
  permission?: Permission;
}>;

/** Options for a handler whose use case owns durable session validation. */
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

/** Metadata key/decorator consumed exclusively by the global admission guard. */
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

/**
 * Declares a route admitted from authenticated request context.
 * The context is a request snapshot, not durable authorization; sensitive use
 * cases must revalidate session, membership, and resource state before writes.
 */
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
