# ADR-0008: Workspace membership administration and ownership safety

- Status: Accepted
- Date: 2026-08-11
- Owners: Nexora Platform Core
- Supersedes: None
- Related issues/changes: Membership administration and ownership safety

## Context

ADR-0007 introduced OWNER, ADMIN, and MEMBER plus email-bound invitations, but
deliberately deferred role mutation, removal, ownership transfer, and their
session effects. The existing `Session(activeWorkspaceId, userId)` foreign key
also retains a relationship to Membership, so hard deletion would either fail
or require deleting session history.

Two ownership concepts already exist and must not be conflated. An OWNER
membership is operational authority inside one workspace. `Organization.ownerUserId`
is commercial ownership across an organization, which may later contain more
than one workspace. This slice needs safe workspace administration without
guessing future organization-wide transfer policy.

## Decision drivers

- Every supported workspace state must have exactly one active OWNER.
- Tenant A identifiers must never address tenant B membership records.
- Route admission is early denial, not durable authorization proof.
- Removal must immediately invalidate only sessions active in the removed
  workspace while retaining session history.
- Re-invitation must not revive an old session token.
- Ownership transfer is a high-impact mutation and requires step-up proof.
- Existing registration, invitation, login, cookie, and session contracts must
  remain compatible.

## Considered options

### Hard-delete memberships after revoking sessions

Rejected. Revoked session rows still reference the membership, and deleting
them would discard retained security state.

### Let role mutation assign or remove OWNER

Rejected. Separate promotion and demotion calls can create zero or multiple
owners and make last-owner races difficult to reason about.

### Transfer organization and workspace ownership together

Rejected for this slice. Organization-wide transfer needs an explicit policy
for organizations with multiple workspaces and belongs to Organizations.

### Soft removal plus a dedicated atomic workspace-owner replacement

Selected. This preserves history, makes reactivation deterministic, and keeps
commercial and operational ownership explicit.

## Decision

Membership adds nullable `removedAt`. Active membership reads, login selection,
request-context resolution, workspace discovery, invitation conflict checks,
and switching ignore removed rows. The unique workspace/user row is retained;
accepting a later invitation reactivates that row with the invited non-owner
role.

The active-workspace APIs are:

- `GET /v1/memberships?cursor=<membershipId>&limit=1..100` lists a bounded page
  of membership ID, safe user ID/display name, role, and creation time. OWNER
  and ADMIN may read it. Cursors are resolved within the trusted workspace.
- `PATCH /v1/memberships/:membershipId/role` accepts only ADMIN or MEMBER.
  OWNER may change a different non-owner; same-role calls are idempotent.
- `DELETE /v1/memberships/:membershipId` soft-removes a different non-owner.
  OWNER may remove ADMIN or MEMBER; ADMIN may remove MEMBER. Missing, removed,
  or foreign-workspace identifiers return idempotent `204`.
- `PUT /v1/memberships/owner` atomically promotes a different active ADMIN or
  MEMBER to OWNER and demotes the acting OWNER to ADMIN.

Generic role mutation and removal never change an OWNER. The ownership use case
requires exactly one active OWNER, revalidates the acting session, verifies the
current password, and reruns the complete policy inside a serializable
transaction. A Redis fixed-window limiter bounds attempts by IP and by
session/workspace and fails closed when enforcement is unavailable. Competing
transfers update the same current-owner row; one wins, while a serialization
retry re-evaluates the new authority.

Every privileged mutation rereads actor and target memberships using trusted
workspace scope inside its transaction and uses conditional writes with the
expected lifecycle and role. Unknown roles, permissions, and transitions fail
closed. State-changing routes require exact trusted Origin.

Removal revokes every unrevoked Authentication-owned session for the target
user whose active workspace is the removed workspace, inside the membership
transaction. A small Authentication session-state module exposes this narrow
contract without creating a Memberships/Authentication module cycle. Redis
cache deletion occurs after commit and is best effort because PostgreSQL is
authoritative. Sessions in other workspaces remain valid. Role changes and
ownership transfer require no token rotation because every request rereads the
membership role from PostgreSQL.

The durable audit actions are `membership.role.updated`,
`membership.removed`, and `membership.ownership.transferred`, with the target
membership UUID as resource. Audits contain no email, password, role value, or
token.

This is workspace operational ownership only. It does not modify
`Organization.ownerUserId`. Organization commercial ownership transfer remains
an Organizations-owned future decision.

Self-service workspace leaving is not included. An OWNER must first use the
explicit transfer; ADMIN cannot remove itself because it may manage MEMBER only.

## Consequences

### Positive

- Supported API flows preserve one active workspace owner.
- Removal retains referential and security history while immediately ending
  workspace access.
- Re-invitation reuses the historical membership row without reviving revoked
  cookies.
- Tenant-scoped reads and conditional writes prevent cross-workspace IDORs.
- Ownership transfer has current-password proof, session revalidation, bounded
  attempts, transactional authority checks, and an auditable one-winner result.

### Negative and tradeoffs

- `removedAt` is lifecycle state, so every future membership reader must
  explicitly select active rows.
- Password verification occurs inside the rare ownership transaction to bind
  confirmation to current credential and session state.
- Prisma does not encode the conditional exactly-one-owner invariant; supported
  mutations preserve it and reject pre-existing zero/multiple-owner states,
  which require reconciliation.
- Membership listing performs bounded Users-contract lookups and intentionally
  excludes email.
- Commercial organization ownership can differ from workspace operational
  ownership after a transfer until a separate organization policy is adopted.

## Compatibility and migration

The HTTP APIs and nullable column are additive. Existing memberships are active
because `removedAt` defaults to null. Development uses `prisma db push`; no
migration history is created.

Once a removal is written, rollback to code that ignores `removedAt` is unsafe
because it would reauthorize removed users. Rollback must retain active-row
filtering and workspace session revocation even if the new mutation routes are
disabled. Existing cookies, session-token format, runtime identifiers, and
role values are unchanged.

## Security, privacy, and tenancy

The server supplies actor, session, and workspace. Strict DTOs reject client
workspace, actor, organization, current-role, and extra-field injection.
Foreign/missing/removed targets have non-enumerating outcomes. Listing exposes
only the safe fields needed for administration. Passwords, session hashes,
emails, SQL details, provider errors, and before/after role values are excluded
from normal logs and audit records.

## Reliability and observability

Serializable transactions retry one PostgreSQL `P2034` conflict and rerun the
entire policy. Conditional writes turn stale target state into a retry or safe
failure. Audit failure rolls back membership and session state. Failures emit
only stable event names, error types, and safe error codes.

## Verification

- Unit tests cover permission, hierarchy, self-action, unknown-role, role
  mutation, removal/session, owner protection, and step-up transfer behavior.
- PostgreSQL E2E tests cover cursor/tenant scoping, strict DTOs, immediate role
  authority, owner protection, workspace-specific session revocation,
  reactivation without token revival, commercial-owner preservation,
  concurrent one-winner transfer, and audit rollback.
- Lint, build, deprecated-API audit, unit tests, E2E tests, Prisma
  synchronization, Graphify refresh, and final diff checks are required.

## Rollout and rollback

Deploy the nullable field and active-row readers before enabling removal. Then
enable session revocation, role mutation, removal, and transfer routes. Monitor
administration unavailable/denied responses, ownership confirmation failures,
rate limits, removed session counts, and audit actions. A rollback may disable
writes but must keep removal-aware readers.

## Follow-up work

- [ ] Define organization commercial ownership transfer across multiple
      workspaces.
- [ ] Add explicit self-service workspace leaving if a concrete consumer needs
      it.
- [ ] Define removed-membership, session, audit, and invitation PII retention.
- [ ] Consider a database partial unique owner constraint at the production
      migration transition.
