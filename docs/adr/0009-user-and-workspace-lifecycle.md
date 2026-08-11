# ADR-0009: Bounded user and workspace lifecycle

- Status: Accepted
- Date: 2026-08-11
- Owners: Nexora Platform Core
- Supersedes: None
- Related issues/changes: User and workspace lifecycle

## Context

Platform Core had durable users, workspaces, memberships, sessions, and audit
records but no supported way to rename a user, rename a workspace, or leave a
workspace. The phrase "lifecycle" also covers much larger state transitions.
User deactivation would interact with organization commercial ownership and
last-workspace ownership. Workspace archival would require every authentication,
membership, invitation, and recovery path to understand the archived state.
Neither transition has a safe recovery or ownership policy yet.

## Decision drivers

- Keep lifecycle mutations inside the module that owns the affected record.
- Derive actor, organization, and workspace only from the authenticated session.
- Revalidate session, membership, role, and mutable state inside the transaction.
- Preserve workspace ownership and prevent self-service final-workspace
  lockout.
- Revoke access immediately when a membership is left while retaining history.
- Avoid adding schema states whose authorization and recovery semantics are not
  yet defined.

## Considered options

### Add user deactivation and workspace archival now

Rejected. Deactivation can strand an organization or its last operational
OWNER, and archival has no authenticated unarchive path. Both require broader
cross-module gates and race policies than this slice can safely infer.

### Implement only display-name and workspace-name updates

Safe but incomplete for the concrete membership lifecycle already represented
by `Membership.removedAt`.

### Add bounded renames plus protected self-leave

Selected. It completes three useful end-to-end operations without adding a new
database state or guessing commercial ownership and recovery policy.

## Decision

Users owns `PATCH /v1/users/me` with the strict body `{ displayName }`.
The active user may change only their own display name. The use case revalidates
the active session and ACTIVE user, conditionally updates the current value in a
serializable transaction, and records `user.profile.updated`. The audit belongs
to the workspace from which the global profile change originated; a future
global audit facility may replace this compromise.

Workspaces owns `PATCH /v1/workspaces/current` with the strict body `{ name }`.
OWNER and ADMIN may rename only the server-resolved active workspace. MEMBER and
unknown roles fail closed. The use case revalidates the active session,
membership, organization/workspace relationship, permission, and expected name
inside a serializable transaction and records `workspace.renamed`.

Memberships owns `DELETE /v1/memberships/me`. The request has no body or target
identifier. ADMIN and MEMBER may leave the server-resolved active workspace.
OWNER must transfer operational ownership first, and the self-service route
requires another active workspace membership. Administrative removal retains
its separate hierarchy policy and may remove a target's final membership. The
self-leave predicate, scoped session revocation, soft removal, and
`membership.left` audit append occur in one serializable transaction.
Concurrent self-leave attempts from a user's final two workspaces therefore
allow one removal and reject the other after re-evaluation.

Leaving revokes every session for that user whose active workspace is the one
being left. Sessions in other workspaces remain valid. PostgreSQL is
authoritative; Redis cache cleanup is best effort after commit. The presented
cookie is cleared on success, and the server does not silently switch it to
another workspace. Re-invitation may reactivate the membership row but cannot
revive previously revoked session tokens.

All three mutations require the exact trusted Origin. Route admission is only
an early denial; each transactional use case rechecks the durable authority it
depends on. Same-value renames are idempotent and do not append duplicate audit
records. Conditional-write or PostgreSQL serialization conflicts retry the
whole decision once.

User deactivation/deletion, workspace archive/delete/create, organization
commercial ownership transfer, and workspace recovery are explicit non-goals.

## Consequences

### Positive

- Clients can maintain common user and workspace names through stable,
  tenant-safe contracts.
- Self-leave reuses the established soft-removal and scoped-revocation model.
- No new schema state or migration is required.
- Ownership and self-service lockout safeguards remain explicit under
  concurrency.

### Negative and tradeoffs

- A global profile update is audited only in its originating workspace because
  the current audit model requires `workspaceId`.
- Self-leave does not require password step-up; the active session, exact
  Origin, owner protection, and final-membership protection are the selected
  controls for this recoverable soft-removal action.
- ADR-0008 already permits workspace operational ownership to diverge from
  organization commercial ownership. After an operational transfer, a
  commercial owner may leave or be administratively removed from that
  organization's workspace while retaining a membership elsewhere. No current
  commercial-owner API requires workspace context, but organization transfer
  and recovery must use an application-authenticated contract that does not
  assume the owner still has an organization workspace membership.
- Full account and workspace state machines remain deferred.

## Compatibility and migration

The three HTTP routes are additive. Existing response, cookie, role, session,
and database contracts remain compatible. There is no Prisma schema change and
no development data synchronization beyond confirming the schema is current.

## Security, privacy, and tenancy

Strict DTOs reject actor, user, organization, workspace, role, and extra-field
injection. Every tenant-owned write carries the trusted workspace and, for a
rename, trusted organization scope. Unknown roles and permissions fail closed.
Audit and normal logs omit names, email, tokens, session hashes, and before/after
values.

## Reliability and observability

Audit failure rolls back each mutation, including session revocation during a
leave. Stable 401, 403, 409, and 503 application errors expose no database or
provider details. Structured failure events include only an event name, error
type, and safe error code.

## Verification

- Unit tests cover rename authorization, trusted-context validation, owner and
  last-membership protection, scoped revocation, and fail-closed policy.
- PostgreSQL E2E tests cover strict DTOs, trusted Origin, authoritative rename
  visibility, OWNER/ADMIN/MEMBER behavior, scoped session revocation, cookie
  clearing, audit rollback, Redis cleanup failure, and concurrent final-two
  workspace leaving.
- Lint, build, unit tests, E2E tests, deprecated-API audit, Prisma schema sync,
  Graphify refresh, and final diff checks are required.

## Rollout and rollback

The routes can be disabled without changing stored data semantics. Rollback
must continue honoring existing `removedAt` memberships and revoked sessions;
it must not restore access for a membership already left through this API.

## Follow-up work

- [ ] Define organization commercial ownership transfer and last-owner policy.
- [ ] Provide commercial-owner recovery independent of workspace membership,
      and decide whether future organization policy should instead require an
      owner membership in at least one organization workspace.
- [ ] Define user deactivation/deletion, retention, reactivation, and recovery.
- [ ] Define workspace archive/delete/create, invitation invalidation, session
      effects, and authenticated unarchive recovery.
- [ ] Consider a global user-security audit scope that does not require a
      workspace identifier.
