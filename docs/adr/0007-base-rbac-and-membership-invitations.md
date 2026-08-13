# ADR-0007: Base RBAC and email-bound membership invitations

- Status: Accepted
- Date: 2026-08-10
- Owners: Nexora Platform Core
- Supersedes: None
- Related issues/changes: Base RBAC plus invitations

## Context

Platform Core already resolves an opaque session into a trusted actor and
active workspace, but every persisted membership was an `OWNER` and route
admission answered only whether a handler was public or authenticated. The
first concrete role-differentiated operation is inviting another active user
to the current workspace. That operation needs a product-neutral permission
catalog, tenant-scoped durable invitation state, secure token delivery, and
authorization that remains valid when the write commits.

Memberships owns membership and invitation lifecycle data. Authorization owns
the base permission and role-grant policy. Identity owns canonical email data,
Users owns the actor-to-identity reference, Audit owns durable audit facts, and
a small outbound-mail module owns the shared SMTP boundary now used by both
Authentication and Memberships.

## Decision drivers

- Existing OWNER registration and session contracts must remain compatible.
- ADMIN and MEMBER memberships must support login, current-session resolution,
  workspace discovery, and explicit session switching.
- Client workspace, actor, role, inviter, and email claims cannot authorize a
  privileged write or invitation acceptance.
- Invitation secrets must be hashed, expiring, replaceable, single-use, and
  safe under concurrent issue and acceptance.
- Authorization must be revalidated inside the serializable state transaction.
- Ownership transfer and last-owner safety remain a separate bounded slice.

## Considered options

### Keep OWNER-only sessions and add invitation records

This is a smaller schema change, but every accepted ADMIN or MEMBER would be
unable to authenticate into the target workspace. It was rejected.

### Trust the role resolved by the request guard

This permits early route denial but leaves a stale-authority race if the actor
is demoted or removed after admission. It was rejected as the only check.

### Add base roles with transactional grant checks and email-bound tokens

This preserves the role-free authenticated context, provides defense-in-depth
route permission checks from the current session, and revalidates current
membership authority inside each write transaction. This option was selected.

## Decision

`MembershipRole` contains `OWNER`, `ADMIN`, and `MEMBER`. Authorization exposes
`membership-invitation:create`, `membership-invitation:revoke`, and the
explicit `membership:read` capability used to detect an existing target
membership, plus this closed grant matrix:

| Actor | May invite or revoke |
| --- | --- |
| OWNER | ADMIN, MEMBER |
| ADMIN | MEMBER |
| MEMBER | none |

Invitations never grant OWNER. Ownership transfer and last-owner protection
remain deferred. Persistence reinforces that boundary with a separate
`MembershipInvitationRole` enum containing only `ADMIN` and `MEMBER`.

`POST /v1/membership-invitations` accepts only normalized email and ADMIN or
MEMBER role. The workspace and actor come from trusted session context. In one
serializable transaction the use case re-reads actor membership, applies the
operation permission and grant policy, rejects an existing target membership,
retires any prior active invitation for the workspace/email pair, creates a new
invitation, and appends `membership.invitation.created`. A nullable unique
active key enforces one live invitation per workspace/email under concurrency.

An authorized OWNER or ADMIN receives a stable conflict when the target is
already a member. This is an intentional, permission-gated membership
existence disclosure; callers without `membership:read` cannot reach it.
Concurrent same-email issuance has one winner and one stable conflict.

`POST /v1/membership-invitations/acceptances` requires an ACTIVE authenticated
account and exact trusted Origin. In one serializable transaction it resolves
the actor's authoritative Identity email, loads the usable invitation by token
hash, revalidates the original inviter's current authority, conditionally
consumes the invitation, creates the unique membership, and appends
`membership.invitation.accepted`. Acceptance does not change the current
session workspace; the existing explicit switch flow remains authoritative.

`DELETE /v1/membership-invitations/:invitationId` is active-workspace scoped.
Foreign, missing, expired, or already-terminal IDs return idempotent `204`
without revealing tenant existence. A visible active invitation is revoked and
audited only after current actor membership and target-role authority are
revalidated in the same transaction.

Invitation tokens contain 32 random bytes encoded as base64url. Only a SHA-256
hash is stored. Raw tokens are delivered after commit through a Memberships
sender port backed by the shared outbound-mail contract. Delivery status is
coarse `PENDING`, `SENT`, or `FAILED`; delivery failure does not roll back the
durable invitation.

Redis-backed fixed-window limits bound creation by IP, actor/workspace, and
target email, and acceptance by IP and authenticated session. Enforcement
failure is fail-closed before any invitation write, audit, or delivery.

## Consequences

### Positive

- Base RBAC has a real Core operation and fails closed for unknown policy data.
- ADMIN and MEMBER sessions work across every existing multi-workspace flow.
- Tokens are email-bound, single-use, tenant-scoped, and replay-safe.
- Stale route snapshots cannot authorize a committed invitation write.
- SMTP implementation is shared without importing Authentication infrastructure.

### Negative and tradeoffs

- An invitee must already have, or first create and verify, a Core account.
- Superseded by ADR-0012: SMTP delivery now uses a Mail-owned encrypted
  PostgreSQL outbox with bounded retry in the same deployable.
- Normalized invitation email is retained as PII until a cleanup policy is
  implemented.
- The create response includes the invited email for the authorized actor, but
  never includes the raw token or token hash.
- Fixed-window counters can conservatively reject a request near a window
  boundary and currently use platform constants rather than tenant policy.

## Compatibility and migration

The API additions are backward compatible. Existing registration still creates
OWNER. Existing cookies, session tokens, routes, and runtime identifiers are
unchanged. Role unions exposed in session and workspace-choice responses are
expanded, so downstream exhaustive validators must accept ADMIN and MEMBER.

Development uses `prisma db push`; no migration history is created. Once
non-OWNER memberships exist, rolling application code back to an OWNER-only
resolver is unsafe. Rollback requires disabling invitation writes and deploying
code that still recognizes all three persisted roles.

## Security, privacy, and tenancy

Route permission checks provide early denial, while creation, revocation, and
acceptance re-read authoritative membership state, the operation permission,
and the target-role grant policy inside the transaction.
Strict DTOs reject client workspace, actor, inviter, and acceptance-role
injection. Acceptance compares the stored normalized email to Identity-owned
data and uses the same generic invalid response for malformed, unknown,
expired, revoked, consumed, superseded, wrong-email, or stale-authority tokens.

Raw tokens, hashes, and invited email are excluded from logs and audit facts.
Audit records contain only UUID actor, workspace, invitation resource, and a
stable action. Workspace-leading indexes and scoped repository operations
prevent foreign invitation IDs from crossing tenant boundaries.

## Reliability and observability

Serializable transactions and conditional terminal updates provide one-winner
acceptance. Acceptance and revocation retry one PostgreSQL serialization
conflict; concurrent issuance conflicts instead of silently replacing the
winner. Uniqueness conflicts become stable conflict or generic invalid outcomes
as appropriate.
Failures emit safe structured event names and error types/codes only. Sender
and delivery-status update failures never expose provider errors or secrets.

## Verification

- Unit tests cover the role/permission and grant matrices, issue denial,
  existing-member conflict, email binding, stale inviter authority, and replay.
- PostgreSQL E2E tests cover strict tenant selection, OWNER/ADMIN/MEMBER flows,
  token hashing, replacement, foreign-ID revocation, concurrent one-winner
  issue and acceptance, audit rollback, delivery failure, expiry, tenant-scoped
  terminal writes, targeted rate limits, stale grant authority, and no implicit
  session switch.
- Lint, build, deprecation audit, unit tests, E2E tests, Prisma synchronization,
  Graphify refresh, and final diff checks must pass.

## Rollout and rollback

Deploy schema and role-aware application code together before issuing
invitations. Monitor authorization denied, invitation invalid/unavailable,
delivery failed, and acceptance audit counts. To roll back, first stop new
invitation creation; preserve role-aware session resolution and reconcile
outstanding invitations and non-OWNER memberships deliberately.

## Follow-up work

- [x] Add workspace ownership transfer and last-owner protection (ADR-0008).
- [x] Add membership role mutation/removal and session effects (ADR-0008).
- [ ] Define invitation PII retention and cleanup.
- [x] Add durable asynchronous email retry (ADR-0012).
- [ ] Design invite-first account onboarding only with a concrete consumer.
