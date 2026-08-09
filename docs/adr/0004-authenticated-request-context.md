# ADR-0004: Propagate a trusted authenticated request context

- Status: Accepted
- Date: 2026-08-09
- Owners: Nexora Platform Core
- Supersedes: None
- Related issues/changes: Tenant-foundation authenticated-context slice

## Context

Platform Core can resolve an opaque session into an authoritative user,
organization, workspace, and membership, but only the current-session endpoint
uses that result. Future Core and downstream tenant routes need one reusable
boundary that prevents controllers from trusting client-selected actor,
workspace, or role values.

Authentication owns session-cookie verification and context assembly. Users,
Organizations, Workspaces, and Memberships retain ownership of their data and
expose the application contracts used during resolution.

## Decision drivers

- Tenant routes need a server-resolved actor and workspace before base RBAC.
- PostgreSQL session and membership state must remain authoritative.
- The public context must be minimal, immutable, and free of credentials or
  personally identifying display data.
- Existing authentication responses and sessions must remain compatible.
- State-changing use cases must not rely on a stale request snapshot for their
  final authorization decision.

## Considered options

### Let each controller resolve its own session and tenant

This avoids a new shared boundary but duplicates security-sensitive logic and
makes it easy for a route to trust a client tenant identifier or omit a check.

### Store ambient context in asynchronous local storage

This makes context globally convenient but hides dependencies and encourages
application code to read mutable ambient state instead of accepting an
explicit capability.

### Resolve once in a guard and attach a minimal immutable context

This centralizes the transport trust boundary while keeping application
dependencies explicit. It also lets existing response DTOs remain separate
from the stable context contract.

## Decision

Authentication exports an `AuthenticatedRequestContextGuard`. The guard reads
only the configured opaque session cookie, delegates to the existing
PostgreSQL-authoritative session resolver, and attaches the result to the
request under a private non-writable symbol.

The public context is a frozen value containing only `sessionId`,
`actorUserId`, `userStatus`, `organizationId`, and `workspaceId`. It excludes
names, email, membership role, raw tokens, token hashes, cache state, route
identifiers, and arbitrary client headers. Controllers obtain it through a
parameter decorator and pass it explicitly to application use cases.

`GET /v1/auth/session` adopts the guard while preserving its existing response
shape. Its presentation DTO remains separate from the minimal context.
PostgreSQL remains authoritative; Redis refresh and cleanup remain best-effort.

The context is a request-time snapshot, not durable authorization proof. A
state-changing use case must revalidate current membership and permission
inside its transaction when stale authorization could cause a write.

Base OWNER, ADMIN, and MEMBER permissions are deliberately deferred until the
first concrete role-differentiated Core operation can exercise them.

## Consequences

### Positive

- Protected routes can share one trusted actor/workspace boundary.
- Client actor, workspace, and role injection cannot alter the context.
- The exported contract stays small and does not freeze the current OWNER-only
  schema into a public RBAC contract.
- No ambient service locator or framework dependency enters domain code.

### Negative and tradeoffs

- Routes must opt into the guard until deny-by-default route eligibility is
  introduced with authorization policy.
- Context resolution performs the existing PostgreSQL-backed lookups on each
  protected request.
- Write use cases may repeat membership checks to close time-of-check/time-of-
  use races.

## Compatibility and migration

The change is additive and does not alter Prisma schema, cookies, environment
configuration, provider behavior, or existing response bodies. Existing
sessions remain valid. Downstream routes may import the exported guard and
context contract when they need trusted tenant scope.

## Security, privacy, and tenancy

Only a hashed opaque session token reaches persistence. Actor and workspace
come from the validated session and its current membership, not headers, route
parameters, request bodies, or UI state. Invalid, expired, revoked, or
inconsistent state fails with the existing stable authentication errors. The
context contains identifiers and status only and is neither logged nor stored.

## Reliability and observability

Context resolution is read-only and emits no audit event. PostgreSQL failures
retain the existing stable unavailable response. Redis outage or cache miss
does not invalidate an otherwise valid PostgreSQL session.

## Verification

- Unit tests prove the public context shape and runtime immutability.
- Existing authentication E2E tests cover missing, expired, revoked, and
  inconsistent sessions plus Redis outage behavior.
- Tenant A/B E2E coverage injects client user, workspace, and role headers and
  verifies that the session's workspace remains authoritative.
- Build, lint, deprecation audit, unit tests, and E2E tests must pass.

## Rollout and rollback

Deploy the additive guard and current-session adoption together. A code
rollback removes the guard integration without data movement; existing
sessions and API responses remain compatible.

## Follow-up work

- [x] Add deny-by-default route eligibility metadata and enforcement through
  ADR-0005.
- [ ] Introduce base RBAC with the first concrete privileged Core operation.
- [ ] Add invitations, workspace switching, ownership transfer, and last-owner
  protection.
