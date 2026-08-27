# ADR-0016: Adopt a lean multi-workspace team Core

- Status: Accepted
- Date: 2026-08-27
- Owners: Nexora Platform Core maintainers
- Supersedes: ADR-0001, ADR-0004, ADR-0007, ADR-0008
- Related decisions: ADR-0002, ADR-0003, ADR-0005, ADR-0006, ADR-0012, ADR-0015

## Context

Platform Core implemented separate identity and credential tables, a commercial
Organization above Workspace, three membership roles, transferable ownership,
per-token mail delivery state, a Redis session cache, and compromised-password
provider integration before any downstream product proved those distinctions.
Those features are functional, but they make the first request flow and normal
NestJS navigation harder to understand than the current product-neutral Core
requires.

The durable requirements are smaller: a user authenticates with email and a
password, may access several independent workspaces, receives one invitation
per workspace, operates in one server-resolved workspace per session, and may
create workspaces that they permanently own.

## Decision

Adopt five primary business concepts: User, Workspace, Membership, Invitation,
and Session.

- User owns normalized email, Argon2id password state, profile, and activation.
- Workspace is the tenant and stores one permanent `ownerUserId`; Organization
  is removed.
- Membership records access only. Public OWNER or MEMBER labels are derived by
  comparing the user with `Workspace.ownerUserId`; stored roles, ADMIN, role
  mutation, and ownership transfer are removed.
- One invitation grants MEMBER access to one workspace. A user may accept
  separate invitations for several workspaces.
- Session stores one trusted `workspaceId`. PostgreSQL is authoritative;
  workspace selection and token-rotating switching remain, while the Redis
  session cache is removed.
- Email verification, password reset, invitations, and the encrypted durable
  mail outbox remain. The outbox is the only delivery-state authority and HTTP
  responses report that email was queued.
- Password normalization, length limits, Argon2id, trusted-origin checks, and
  distributed rate limiting remain. External compromised-password screening is
  removed until a concrete consumer requires it.
- Sessions become a conventional internal feature module consumed by
  Authentication, Memberships, Users, and Workspaces. The previous nested
  session-state cycle breaker is removed.

## Consequences

Registration creates User, Workspace, owner Membership, verification token,
Session, AuditLog, and MailOutboxMessage atomically. Authenticated active users
may create more workspaces without changing their current session. Owners may
invite and remove members but may not leave or be removed from their owned
workspace. Members may leave; workspace-local sessions are revoked on removal
or leave.

The registration and session wire contracts remove organization data.
Invitation creation no longer accepts a role. Role-update and ownership-transfer
routes and their stable errors are removed. The OpenAPI contract intentionally
changes without compatibility aliases.

Identity, PasswordCredential, Organization, stored membership-role, duplicate
delivery-state, and old session columns are deleted. This repository is still
development-only, so the approved rollout resets the guarded development and
test databases with `prisma db push`; it creates no migration history or data
backfill. Existing sessions become invalid.

## Security and reliability

Route admission remains deny by default and installed exactly once. Actor,
workspace, ownership, and membership are resolved from PostgreSQL, never client
tenant headers. Session switching continues to revalidate access and rotate the
opaque token transactionally. Verification, reset, invitation, and session
tokens remain hashed and single-use where applicable.

Mail enqueue remains atomic with the owning workflow. The outbox retains
encrypted payloads, fenced claims, bounded retry, terminal payload erasure, and
at-least-once semantics. Redis remains for distributed rate limiting only.

## Verification

- Architecture checks enforce table ownership, conventional module placement,
  private repositories, an acyclic module graph, and one global guard.
- Unit and E2E coverage verifies registration, verification, password flows,
  multi-workspace selection/switching, permanent-owner rules, invitation scope,
  session revocation, tenant A/B denial, and outbox retry/fencing.
- OpenAPI, onboarding, module catalog, tenant matrices, environment guidance,
  seed data, and Graphify are updated with the implementation.

## Rollback

Rollback is a source revert plus another destructive development/test database
reset to the prior Prisma schema. There is no production-data rollback path;
production adoption requires a separate forward migration plan.
