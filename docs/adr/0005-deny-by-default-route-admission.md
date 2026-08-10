# ADR-0005: Deny routes unless admission policy is explicit

- Status: Accepted
- Date: 2026-08-09
- Owners: Nexora Platform Core
- Supersedes: None
- Related issues/changes: Authenticated route-admission foundation

## Context

Platform Core resolves an opaque session into a trusted immutable actor and
workspace context, but controllers currently opt into authentication with
route-local guards. A new tenant route could therefore omit its guard and run
without an explicit authentication decision. Origin validation is also
repeated independently on each state-changing authentication route.

The current application has public credential, verification, reset, and login
routes; authenticated account and session routes; an intentionally idempotent
logout route; and a public starter health response. Pending-verification users
must retain access to the account and session operations needed to verify,
secure, inspect, or leave their session, while future tenant operations must
require an active user unless they explicitly opt into pending access.

Base OWNER, ADMIN, and MEMBER permissions still lack a concrete
role-differentiated Core operation and remain outside this decision.

## Decision drivers

- Fail closed when a controller or handler has no admission classification.
- Resolve actor and workspace only from the configured opaque session cookie.
- Require active users by default without breaking pending-account recovery.
- Preserve exact-origin protection and run it before session resolution.
- Preserve existing successful API responses, cookies, and idempotent logout.
- Keep role and permission policy out of this route-admission-only slice.

## Considered options

### Continue attaching guards to individual routes

This preserves the current code but leaves authentication omission as an easy
and silent failure mode as tenant and downstream routes are added.

### Make authentication global with a public-route escape hatch

This follows the common framework pattern, but a boolean public flag cannot
express pending-user access or exact-origin requirements. It also risks moving
origin validation after session work when global guards run before route-local
guards.

### Use one typed global route-admission policy

This makes every route choose public, context-authenticated, or explicitly
application-authenticated access, carries trusted-origin and pending-user
requirements in the same policy, and lets one global guard execute those checks
in the required order.

## Decision

Authorization owns a typed `RouteAdmission` metadata contract and one global
`RouteAdmissionGuard`, registered through Nest's `APP_GUARD` provider. It
depends on Authentication's exported exact-origin and authenticated-context
guards; Authentication retains ownership of session and credential decisions.

Every Nest route must apply either:

- `PublicRoute`, optionally requiring a trusted Origin; or
- `AuthenticatedRoute`, which requires a valid PostgreSQL-authoritative
  session and active user status by default, and may explicitly permit a
  `PENDING_VERIFICATION` user or require a trusted Origin; or
- `ApplicationAuthenticatedRoute`, reserved for credential or session
  self-service use cases that validate the session themselves and cannot depend
  on a complete tenant context.

The global guard reads handler metadata only; controller-level metadata cannot
make a later handler public implicitly. Missing or malformed metadata fails with
stable `ROUTE_ACCESS_DENIED` and HTTP 403 and emits a redacted diagnostic with
only controller and handler identities. For routes that require an Origin,
exact-origin validation runs first. `AuthenticatedRoute` then reuses
`AuthenticatedRequestContextGuard`, which attaches the existing private
immutable request context. A pending user on an active-only route fails with
stable `EMAIL_VERIFICATION_REQUIRED` and HTTP 403.

All current state-changing authentication routes continue to require a trusted
Origin. Registration, email verification, password reset, and login remain
public. Current-session resolution requires a complete authenticated context
and explicitly permits pending users. Password change and revoke-all use
application-owned authentication so their existing rate-limit, active-user,
transactional, and degraded-tenant-state behavior remains authoritative.
Current-session logout remains anonymously callable and idempotent, but still
requires a trusted Origin. The starter health route remains public.

This policy answers only route admission. It does not define roles,
permissions, resource authorization, entitlements, or tenant-owned repository
access. A state-changing use case must still revalidate current membership and
authorization inside its transaction when a stale request snapshot could
permit an invalid write.

## Consequences

### Positive

- New routes fail closed until their admission behavior is explicit.
- Authenticated routes share the same server-resolved actor/workspace boundary.
- Active-user access is the safe default for future tenant operations.
- Exact-origin checks cannot accidentally run after authentication work.
- Pending-account and idempotent-logout compatibility remains explicit and
  testable.

### Negative and tradeoffs

- Every controller method needs admission metadata, including public health
  routes.
- Application-authenticated routes require careful review because the global
  guard deliberately leaves session validation to their use case. The exception
  preserves password-change throttle ordering and emergency session revocation.
- Permission checks still require a later role/permission expansion of
  Authorization and a concrete privileged operation.

## Compatibility and migration

The change is code-only. It does not alter Prisma schema, stored data, session
cookies, environment configuration, request bodies, successful response
bodies, or OpenAPI route paths. Existing sessions remain valid. Clients may
receive stable 403 responses when a pending user calls an active-only route or
when a newly introduced route lacks valid admission metadata.

## Security, privacy, and tenancy

Only the configured opaque session cookie can establish authenticated context.
Client actor, workspace, role, or status headers are ignored. PostgreSQL
session, user, workspace, and membership state remains authoritative. Denied
and authenticated responses are non-cacheable. No credentials, tokens,
personally identifying display data, or route metadata are logged or persisted.

Route admission is not resource authorization. Future tenant use cases must
authorize the action and resource against current server-side membership and
scope every repository operation by the trusted workspace.

## Reliability and observability

Admission is synchronous and has no retry, idempotency, queue, webhook, or
provider behavior. Public routes add no persistence work. Authenticated routes
retain existing stable unavailable handling when PostgreSQL resolution fails
and treat Redis only as a disposable cache. Unclassified and pending-user
denials use stable safe error bodies with request IDs.

Swagger UI remains adapter-mounted at `/docs` and is not treated as a Nest
controller route by this guard. It remains publicly reachable for the current
development baseline; production documentation exposure remains part of the
later deployment-topology decision.

## Verification

- Unit tests cover unclassified denial, trusted-origin ordering, active-user
  admission, pending-user denial, and explicit pending access.
- E2E tests cover an unclassified route, missing-session denial, pending versus
  active behavior, and preservation of the public health route.
- Existing authentication E2E coverage verifies route success behavior,
  exact-origin rejection, session revocation, tenant-header injection, and
  pending-account flows.
- Build, lint, deprecation audit, unit tests, and E2E tests must pass.

## Rollout and rollback

Deploy the metadata, global guard, route classifications, and stable error
mapping together. Monitor 401 and 403 error-code counts for unexpected route
classification failures. Rollback is code-only and requires no data movement;
existing cookies and persisted sessions remain compatible.

## Follow-up work

- [x] Define multi-workspace login selection and active-workspace switching
  through ADR-0006.
- [ ] Introduce base RBAC with the first role-differentiated Core operation.
- [ ] Add invitations, ownership transfer, last-owner protection, and broader
  tenant-isolation matrices.
