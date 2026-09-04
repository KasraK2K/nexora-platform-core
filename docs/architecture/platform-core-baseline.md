# Platform Core baseline

This document defines the implemented product-neutral baseline after ADR-0016.
It is a target boundary, not permission to add speculative product features.

## Mission

Provide a small, secure NestJS foundation for email/password users who may own
or join several independent workspaces. Keep one deployable modular monolith
until measurable extraction criteria exist.

## Business model

The Core business vocabulary is limited to User, Workspace, Membership,
Invitation, and Session. Supporting security/operations records include email
verification, password reset, audit, and durable mail outbox.

- Workspace is the operational tenant.
- Workspace has one permanent `ownerUserId`.
- Membership stores access, not role.
- OWNER/MEMBER is derived at read time.
- Invitation always grants MEMBER access to one workspace.
- Session has one server-authoritative `workspaceId`.

Commercial organizations, ADMIN role, role mutation, ownership transfer,
alternative login methods, billing, account deletion, and workspace deletion
are deferred until a concrete consumer requires them.

## Source structure

```text
src/
  app.module.ts
  main.ts
  configure-app.ts
  config/
  common/
  infrastructure/
    infrastructure.module.ts
    database/
    cache/
  modules/
    users/
    workspaces/
    memberships/
    sessions/
    authentication/
    authorization/
    audit/
    mail/
    health/
    observability/
```

Small modules use `<feature>.module.ts`, `<feature>.controller.ts`,
`<feature>.service.ts`, and a private concrete `<feature>.repository.ts`.
Controllers do not import repositories, Prisma, or infrastructure. Generic
architecture-layer folders are not used inside features.

## Dependency and ownership rules

- Controllers call services.
- Services call their private concrete repositories or another module's
  exported service.
- Only a table's owning module may access its Prisma delegate.
- Repositories and adapters are never exported.
- Interfaces are reserved for external boundaries, volatile policies, or a
  second proven implementation.
- Core never imports downstream product code.

Cross-feature workflows use imported modules and their exported focused
services. ADR-0017 permits only a narrow presentation/security exception:
Authentication's authenticated-context decorator and context/origin guards,
plus Authorization's route metadata, pure policy, and stable errors. Those
feature-owned contracts cannot expose or directly depend on repositories,
infrastructure, providers, workers, caches, rate-limit implementations, or
downstream products. Public result types live in feature-level `*.types.ts`
files and remain available through their owning service's type re-exports.

## Security baseline

- Argon2id password hashes with NFC and bounded input.
- Opaque cookie sessions; only SHA-256 token hashes persist.
- PostgreSQL-authoritative session and membership checks.
- One global deny-by-default route admission guard.
- Exact trusted-origin validation for protected browser mutations.
- Distributed Redis rate limiting through one shared fixed-window engine.
- Hashed, expiring, single-use verification/reset/invitation tokens.
- Permanent owners cannot leave or be removed.
- Tenant-owned reads/writes/audits always use trusted workspace scope.

## Transaction and mail baseline

Feature service methods own serializable transaction boundaries. Registration
atomically creates User, Workspace, owner Membership, verification token,
Session, Audit, and MailOutboxMessage. Workspace creation atomically creates the
Workspace, owner Membership, and Audit. Invitation acceptance can reactivate a
soft-removed membership.

Mail requests enqueue encrypted outbox state in their business transaction. The
worker is the only delivery authority and retains retry, fencing, lease renewal,
at-least-once semantics, and payload erasure. API contracts report queued state.

## Public compatibility

The lean transition intentionally breaks TypeScript paths and the HTTP fields
that exposed removed concepts. Current routes for authentication, workspace
selection, invitations, membership list/removal/leave, profile update, and
workspace rename remain. `POST /v1/workspaces` creates additional workspaces.
The OpenAPI contract is the source of truth.

## Data workflow

Until an explicit production transition, change `prisma/schema.prisma`, run the
guarded local `prisma db push`, and create no migrations. Reset or data-loss
operations must identify and confirm the exact local target. Production
synchronization is prohibited.

## Product extension boundary

A downstream repository owns customer workflows, product schema/API/UI,
providers, prompts, retrieval, evaluation data, product pricing, and product
usage policy. Promote a capability into Core only for a second proven consumer
or an explicit reusable platform requirement.

## Definition of done

Architecture, type, lint, deprecated API, operations, production-readiness,
Nest CLI, unit, E2E, OpenAPI, documentation, build, diff, and Graphify checks
must pass in proportion to the change. Authentication/tenancy changes require
session, origin, malformed DTO, tenant A/B, rollback, audit, and mail-outbox
evidence.
