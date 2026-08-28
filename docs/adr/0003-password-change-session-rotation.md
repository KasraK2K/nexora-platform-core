# ADR-0003: Rotate the current session after authenticated password change

- Status: Accepted
- Date: 2026-08-09
- Owners: Nexora Platform Core
- Supersedes: None
- Related issues/changes: Authenticated password-change vertical slice
- Amended by: ADR-0016, which moved password state into `User` and made
  `SessionsModule` the session-table owner without changing rotation behavior

> Current-model note: references below to Identity, PasswordCredential, or the
> old ownership split describe the historical design reviewed by this ADR.
> Follow ADR-0016 and the Platform Core baseline for current source navigation.

## Context

Platform Core supports password registration, login, reset, and session
revocation, but it does not yet let an authenticated user change their
password. The operation must prove knowledge of the current password, prevent
concurrent reuse of stale credentials, invalidate older recovery authority,
and define what happens to existing sessions.

Authentication owns the HTTP workflow and sessions. Identity owns password
verification and credential persistence. Users owns the mapping from a session
user to its stable identity. Audit owns security-event persistence.

## Decision drivers

- A stolen or forgotten session must not survive a credential change.
- The device performing a legitimate change should remain signed in without
  retaining its old bearer token.
- Password-reset links issued before the change must no longer be usable.
- Credential, session, recovery-token, and audit state must not partially
  commit.
- Password change must not silently extend the absolute session lifetime.

## Considered options

### Revoke every session and require a fresh login

This is simple and matches password-reset behavior, but unnecessarily disrupts
the authenticated device that has just proved the current password.

### Keep the current session token and revoke only other sessions

This preserves continuity, but leaves the pre-change bearer token valid and
does not provide session fixation resistance for the changing device.

### Revoke every session and atomically create a replacement current session

This invalidates every pre-change bearer token while keeping the verified
device signed in. It requires replacement-session creation to share the
credential-change transaction.

## Decision

Add `PUT /v1/auth/password` with a strict body containing only
`currentPassword` and `newPassword`. The actor, user, identity, and workspace
are resolved server-side from the opaque session cookie. Only an active user
with a valid, unexpired session and current workspace membership may proceed.

Identity verifies the current password and returns an opaque credential proof.
Authentication validates and compromise-screens the replacement and
hashes it outside the database transaction. A serializable transaction then:

1. revalidates the exact presented session and trusted membership;
2. conditionally replaces the password hash only if the verified credential
   proof still matches the stored hash;
3. invalidates all open password-reset tokens for the user;
4. revokes all existing sessions;
5. creates one replacement session for the same user and trusted workspace;
6. appends `password.change.completed` audit records for each workspace
   represented by the revoked sessions.

The replacement session receives a new server-generated opaque token but
preserves the presented session's absolute expiry. PostgreSQL remains
authoritative. Old Redis entries are removed and the replacement entry is
stored only after commit, both best-effort.

Password reset remains different: it proves recovery-token possession rather
than the current password, revokes every session, clears the cookie, and
requires a fresh login.

## Consequences

### Positive

- Every pre-change session token becomes unusable.
- Concurrent requests cannot both reuse the old password successfully.
- Previously issued reset links cannot overwrite the new password.
- The current device remains signed in with a rotated token and no lifetime
  extension.
- The change remains product-neutral and uses existing Core ownership
  boundaries.

### Negative and tradeoffs

- The use case coordinates several Core module contracts in one transaction.
- Cache cleanup may temporarily leave revoked markers, although PostgreSQL
  validation remains authoritative.
- A successful change is intentionally irreversible; old sessions and the old
  password cannot be restored by rolling back application code.

## Compatibility and migration

The HTTP route and application contracts are additive. No Prisma schema,
dependency, provider, cookie-name, or environment change is required. Existing
clients continue to work. Clients adopting the route must accept the
replacement `Set-Cookie` header on a `204 No Content` response.

## Security, privacy, and tenancy

Exact-Origin validation and fail-closed IP plus HMAC-session rate limits run
before Argon2 and compromise checking. Request bodies cannot supply email,
user, identity, workspace, membership, or role identifiers. Passwords, raw
session tokens, token hashes, and PII are not logged. Audit records use only
the server-resolved actor and affected workspaces.

## Reliability and observability

Serializable transaction conflicts receive one bounded retry. Invalid or
stale current credentials fail safely. Transactional failures emit a safe
structured event without secrets and return a stable unavailable error. Redis
maintenance failures do not undo committed PostgreSQL state.

## Verification

- Unit tests cover success, stale or incorrect current credentials, invalid or
  compromised replacements, and cache failure.
- PostgreSQL E2E tests cover rotation, reset-link invalidation, tenant
  isolation, rollback on audit failure, concurrent reuse of the old password,
  strict transport validation, Origin enforcement, and rate-limit failure.
- Build, lint, deprecation audit, unit tests, and E2E tests must pass.

## Rollout and rollback

Deploy the additive route with the existing application. A code rollback may
remove the route without a data migration; replacement sessions use the
existing schema and remain valid. Password hashes and revoked sessions already
committed before rollback remain intentionally changed.

## Follow-up work

- [x] Introduce immutable authenticated actor/workspace context.
- [ ] Add deny-by-default route eligibility and base RBAC.
- [ ] Add invitations, workspace switching, ownership transfer, and broader
      tenant-isolation matrices.
