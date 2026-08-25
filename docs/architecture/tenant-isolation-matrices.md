# Tenant isolation matrices

This document is the coverage contract for the tenant-owned surfaces currently
implemented in Nexora Platform Core. `Workspace` is the operational tenant.
Every new tenant-owned repository method or HTTP route must add both a positive
same-tenant case and a negative tenant A/B case before it is considered done.

The executable matrices live in the capability specifications under `test/e2e/` and run against real
PostgreSQL through the normal Nest application. The focused tests are:

- `enforces the tenant-isolation matrix for HTTP reads and resource mutations`;
- `enforces the tenant-isolation matrix for workspace-scoped repositories`.

Existing behavior tests named below remain part of the matrix because they
exercise transaction, concurrency, lifecycle, and token-capability paths that
the focused tests intentionally do not duplicate.

## Scope models

| Model                  | How scope is established                                                                      | Client workspace input                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Trusted session        | Opaque cookie -> authoritative session -> active membership -> immutable request context      | Ignored; forged actor, workspace, and role headers cannot change scope            |
| Selected workspace     | Authenticated user plus an explicit workspace selector revalidated against active memberships | Accepted only by login/switch contracts and denied for an inaccessible workspace  |
| Resource identifier    | Route UUID is always combined with the trusted workspace in reads and conditional writes      | Foreign, missing, and removed identifiers are non-enumerating                     |
| Token capability       | SHA-256 hash of a random verification, reset, or invitation token resolves the owning record  | No workspace ID is accepted; the record supplies scope after the secret is proven |
| Actor-global operation | Verified actor identity scopes the operation across that actor's records                      | Cannot name another user; originating workspace scopes the audit where required   |

## HTTP endpoint matrix

| Surface                                       | Scope rule                                                                                   | Positive control                                                          | Tenant A/B denial                                                                                    |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `POST /v1/auth/registrations`                 | Creates a new organization/workspace graph atomically                                        | `registers one complete account graph and resolves its trusted workspace` | Equivalent email and transaction rollback tests prevent graph overlap or partial ownership           |
| Verification request/confirmation             | Normalized identity lookup or hashed token capability; token record supplies audit workspace | Verification replacement, expiry, and replay tests                        | Wrong, expired, and replayed capabilities cannot activate or write another account                   |
| Password-reset request/confirmation           | Normalized identity lookup or hashed token capability; revocation is actor-global            | Reset replacement and confirmation tests                                  | Reset tests assert unrelated users and sessions remain unchanged                                     |
| `POST /v1/auth/sessions`                      | Credentials resolve the user; selected workspace must be an active membership                | Login and explicit multi-workspace selection tests                        | Random or inaccessible workspace selectors return the generic authentication failure                 |
| `GET /v1/auth/session`                        | Trusted session context only                                                                 | Current-session tests                                                     | HTTP matrix proves forged actor/workspace/role headers still return tenant A                         |
| `GET /v1/auth/session/workspaces`             | Active memberships for the authenticated actor                                               | Workspace listing test                                                    | HTTP matrix proves tenant B is excluded despite forged headers                                       |
| `PUT /v1/auth/session/workspace`              | Source session and target membership are revalidated transactionally                         | Workspace rotation and concurrency tests                                  | HTTP matrix and switching tests deny tenant B and preserve the source session                        |
| Password change and session revocation routes | Presented session or authenticated user; no target user/workspace input                      | Password/session lifecycle tests                                          | Tests prove another user and another workspace's sessions remain unaffected                          |
| `POST /v1/membership-invitations`             | Trusted active workspace plus in-transaction grant policy                                    | RBAC/invitation tests                                                     | HTTP matrix proves forged headers create only in tenant A                                            |
| `POST /v1/membership-invitations/acceptances` | Email-bound token capability supplies the destination workspace                              | Invitation binding, replay, and concurrency tests                         | A different identity cannot consume the token; acceptance does not switch the current session        |
| `DELETE /v1/membership-invitations/:id`       | Trusted workspace plus resource UUID                                                         | Invitation lifecycle tests                                                | HTTP matrix proves tenant A receives idempotent `204` and tenant B is unchanged                      |
| `GET /v1/memberships`                         | Trusted workspace; cursor is resolved inside that workspace                                  | Membership paging test                                                    | HTTP matrix excludes tenant B and rejects its membership UUID as a cursor                            |
| Membership role/removal routes                | Trusted workspace plus target UUID and hierarchy policy                                      | Membership administration test                                            | HTTP matrix proves foreign UUIDs are non-enumerating no-ops                                          |
| `PUT /v1/memberships/owner`                   | Trusted workspace, current password, exactly-one-owner check, and scoped target UUID         | Ownership transfer and concurrency tests                                  | HTTP matrix returns the generic invalid-transfer response and leaves both tenants unchanged          |
| `DELETE /v1/memberships/me`                   | Trusted active workspace and authenticated actor                                             | Self-leave and final-membership race tests                                | Existing test proves only active-workspace sessions are revoked and another workspace remains usable |
| `PATCH /v1/users/me`                          | Authenticated actor; workspace is audit origin, not target selection                         | Profile lifecycle tests                                                   | HTTP matrix proves forged user/workspace headers update tenant A's actor only                        |
| `PATCH /v1/workspaces/current`                | Trusted workspace and organization from the session context                                  | OWNER/ADMIN rename tests                                                  | HTTP matrix proves forged headers rename tenant A only                                               |

## Repository matrix

| Owner / adapter                                                  | Workspace-scoped operations                                                                                                                         | Negative matrix assertion                                                                                          |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Memberships / `PrismaMembershipsRepository`                      | `find`, `findActiveById`, `findActiveForUser`, `listActive` and cursor resolution, `updateRole`, `remove`, `countActiveOwners`, `transferOwnership` | Tenant A cannot read, page from, mutate, remove, count, or promote tenant B rows; all B rows remain unchanged      |
| Membership Invitations / `PrismaMembershipInvitationsRepository` | `retireActive`, `findActiveById`, `findActiveForEmail`, `revoke`, `accept`, `markDelivery`                                                          | Tenant A scope cannot find or terminally update tenant B's invitation                                              |
| Authentication / `PrismaAuthenticationSessionsRepository`        | `findLatestForUser` joins an active membership; `hasActiveContext` and `revokeActiveForMembership` match workspace explicitly                       | Removed tenant context cannot anchor recovery; a mismatched workspace cannot validate or revoke tenant B's session |
| Workspaces / `PrismaWorkspacesRepository`                        | Conditional `rename` uses workspace ID plus organization ID                                                                                         | Tenant A organization scope cannot rename tenant B's workspace                                                     |
| Audit / `PrismaAuditLogRepository`                               | Append-only input always carries the use case's trusted workspace                                                                                   | HTTP matrix asserts tenant A actions never append tenant B audit rows                                              |

The remaining repository methods are deliberately not workspace selectors:

- session token methods are scoped by an unguessable token hash;
- revoke-all is authenticated-user scoped across that user's workspaces;
- verification, reset, and invitation token lookup is capability scoped;
- Users is actor-global, Organizations is the commercial root, and Workspace
  `findById`/`findByIds` receives IDs derived from trusted memberships or
  already-resolved context;
- creation methods receive IDs from the owning transaction and do not expose a
  caller-addressable read or mutation surface.

`transferOwnership` is a compound adapter operation. Both membership IDs are
validated inside the supplied workspace before its first write, and the
application service must execute the promotion/demotion pair inside its
serializable transaction so concurrent state changes cannot leave a partial
owner replacement.

The repository matrix includes a positive invitation token-capability lookup
to prevent future changes from incorrectly requiring an attacker-supplied
workspace alongside the secret.

## Completion rule

The current matrix is complete only while the implemented surface remains the
one listed above. A future tenant-owned endpoint, repository method, cache key,
job, webhook, file operation, or external request must extend this document and
the executable positive/negative matrix in the same change. PostgreSQL RLS may
later add defense in depth, but it does not replace these application and
repository checks.
