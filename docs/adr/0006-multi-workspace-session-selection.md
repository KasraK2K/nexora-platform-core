# ADR-0006: Select and switch the active workspace per session

- Status: Accepted
- Date: 2026-08-10
- Owners: Nexora Platform Core
- Supersedes: None
- Related issues/changes: Multi-workspace selection and switching
- Amended by: ADR-0016, which renamed `activeWorkspaceId` to `workspaceId`,
  removed Organization, and removed the Redis session cache without changing
  server-authoritative workspace selection or token rotation

> Current-model note: the historical design discussion below retains the names
> that existed when this decision was accepted. Follow ADR-0016 and the
> Platform Core baseline for current source and schema names.

## Context

Platform Core permits one user to hold memberships in multiple workspaces, but
returning-user login previously rejected any account with more than one
membership. Existing sessions already carry one `activeWorkspaceId`, and the
authenticated request context resolves that workspace and its membership from
PostgreSQL. Clients need a bounded way to discover valid choices, select one at
login, and change one session's active tenant without trusting a header or
allowing an old bearer token to follow the actor into the new tenant.

Authentication owns opaque sessions and their active-workspace selection.
Memberships, Workspaces, and Organizations retain ownership of membership and
tenant data and expose narrow application contracts used by Authentication.

## Decision drivers

- Single-workspace login must remain compatible.
- Invalid credentials must never reveal workspace memberships.
- Client workspace identifiers are selectors, not authorization proof.
- A workspace change must be isolated to the presented session.
- A stolen pre-switch cookie must not inherit access to the new workspace.
- PostgreSQL state, audit records, and the replacement session must commit
  atomically; Redis remains disposable.
- Workspace discovery must be bounded and avoid per-membership query fan-out.

## Considered options

### Choose the most recent workspace automatically

This avoids a new client state but makes tenant selection implicit, can reopen
the wrong commercial context, and gives users no deterministic choice.

### Mutate `Session.activeWorkspaceId` while keeping the token

This is a small write, but the same bearer token would gain authority in the
new workspace and any old cache entry could retain stale tenant state.

### Require explicit selection and rotate on a real switch

This keeps selection visible, validates membership server-side, and prevents a
pre-switch token from following the user across tenant contexts. It requires a
new cookie on successful switches.

## Decision

`POST /v1/auth/sessions` accepts an optional UUID `workspaceId` selector.
Authentication verifies the password and active user before resolving any
workspace choice. With one membership and no selector, login preserves the
existing behavior. With multiple memberships and no selector, it returns
`409 WORKSPACE_SELECTION_REQUIRED`, no cookie or durable write, and a bounded
list of safe organization, workspace, and membership summaries. An explicit
selector is validated against current membership; a missing membership uses
the same generic `AUTHENTICATION_INVALID` response as invalid credentials.

`GET /v1/auth/session/workspaces` lists choices for the server-resolved actor
and returns the active workspace ID in response metadata. Discovery reads at
most 101 memberships to enforce a maximum response of 100 and batch-loads the
owned Workspace and Organization summaries. Accounts exceeding that
operational bound must use a known explicit selector until paginated workspace
management is introduced.

`PUT /v1/auth/session/workspace` accepts only a UUID `workspaceId`, requires an
active authenticated user and exact trusted Origin, and is bounded by an IP
plus HMAC-session Redis rate limit. Inside one serializable transaction it:

1. revalidates the exact unrevoked, unexpired presented session and request
   context;
2. revalidates the active user, source membership, and target membership;
3. returns idempotently without a write when the target is already active;
4. revokes the presented session and creates a fresh opaque session for the
   target workspace while preserving the absolute expiry;
5. appends `auth.workspace.switched` audit records in both source and target
   workspace scopes.

One bounded retry handles a PostgreSQL serialization conflict. After commit,
the old Redis entry is removed and the replacement entry is stored on a
best-effort basis. PostgreSQL remains authoritative.

## Consequences

### Positive

- Multi-workspace users can authenticate and choose a deterministic tenant.
- Workspace identifiers never authorize access without a current membership.
- The old bearer token cannot gain authority in the selected target workspace.
- Separate sessions for the same user remain independently scoped.
- Discovery is bounded to three batched persistence reads.

### Negative and tradeoffs

- Clients must handle `409 WORKSPACE_SELECTION_REQUIRED` and accept a
  replacement cookie after switching.
- A shared browser cookie means switching affects every tab using that session.
- The current 100-workspace discovery bound is not cursor pagination; broader
  workspace lifecycle and pagination remain follow-up work.
- The audit schema lacks structured before/after metadata, so the same action
  is recorded once in each affected workspace.

## Compatibility and migration

The change is additive and requires no Prisma schema, data migration,
dependency, environment, or cookie-name change. Existing sessions and
single-workspace login clients remain valid. Multi-workspace login intentionally
changes from generic `401` to actionable `409` only after correct credentials.
Sessions created by the switch remain valid if application code is rolled back
because the existing resolver already supports any membership-backed
`activeWorkspaceId`.

## Security, privacy, and tenancy

Credential verification precedes membership disclosure. Login selectors,
switch bodies, route IDs, headers, and UI state are never trusted as
authorization. Switching revalidates both source and target membership inside
the write transaction. Strict DTOs reject actor, organization, role, and extra
fields. Rate-limit keys contain only keyed digests. Raw tokens, token hashes,
credentials, and PII are not logged. Only the workspace-selection error has an
allow-listed public details shape; other application-error details remain
redacted.

## Reliability and observability

Switch transaction failures emit a safe structured event and return stable
`WORKSPACE_SWITCH_UNAVAILABLE`. Limiter failure returns the same fail-closed
service-unavailable response before durable writes. Cache failures do not undo
committed PostgreSQL state. Switch success is represented by two append-only
audit facts; no job, outbox, webhook, provider, or external effect is added.

## Verification

- Unit tests cover single-workspace compatibility, required selection,
  explicit selection, inaccessible selection, successful rotation,
  cross-tenant denial, cache maintenance, and same-target idempotency.
- PostgreSQL/Redis E2E tests cover safe choice disclosure, strict validation,
  actor-only listing, tenant A/B denial, absolute-expiry preservation, old
  cookie invalidation, audit rollback, limiter denial/failure, arbitrary error
  detail redaction, and concurrent single-winner switching.
- Build, lint, deprecation audit, unit tests, and E2E tests must pass.

## Rollout and rollback

Deploy the additive contracts and clients capable of handling `409` and the
switch `Set-Cookie` header. Monitor selection-required, switch-denied,
rate-limited, unavailable, and authentication-failure counts. Code rollback
requires no data movement; already revoked tokens remain revoked and
replacement sessions remain valid until their original absolute expiry.

## Follow-up work

- [ ] Add cursor pagination if a real consumer needs more than 100 accessible
      workspaces.
- [ ] Define membership removal and workspace archival behavior for sessions
      referencing those memberships.
- [x] Add base roles and invitations through ADR-0007.
- [ ] Add ownership transfer and last-owner safety.
