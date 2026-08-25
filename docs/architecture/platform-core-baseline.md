# Nexora Platform Core - Implementation Baseline

## Purpose

Nexora Platform Core is a reusable, product-neutral SaaS foundation. It owns
cross-product identity, tenancy, security, operational, and optional commercial
capabilities. A downstream repository owns each customer-facing product and its
product-specific workflows, data, provider integrations, prompts, evaluation
sets, usage policy, and UI.

Use `docs/architecture/downstream-product-guide.md` when creating that
repository.

This document is a target baseline, not evidence that every component exists.
Inspect the current code, schema, lockfile, scripts, tests, and runtime
configuration before making an implementation claim.

Material deviations require an ADR based on `docs/adr/0000-template.md`.

## Current state

The repository is currently one NestJS modular monolith. It implements:

- password identity registration and Argon2id credentials;
- user, organization, workspace, and OWNER membership creation;
- opaque server sessions backed authoritatively by PostgreSQL with Redis cache;
- returning-user login, current-session resolution, logout, and revoke-all;
- pending-account email verification with hashed, expiring, replaceable,
  single-use tokens and enumeration-resistant resend behavior;
- password reset with hashed, expiring, replaceable, single-use tokens,
  compromised-password screening, and transactional session revocation;
- authenticated password change with current-password proof, optimistic
  credential replacement, reset-link invalidation, and current-session
  rotation without extending its absolute expiry;
- immutable authenticated actor/workspace context resolved from the opaque
  session and authoritative membership, never from client tenant headers;
- deny-by-default route admission with explicit public, context-authenticated,
  or application-authenticated metadata, active-user defaults, pending-user
  opt-in, and trusted-origin ordering;
- base OWNER, ADMIN, and MEMBER authorization plus hashed, expiring,
  email-bound membership invitation creation, acceptance, and revocation;
- active-workspace membership listing, role mutation, soft removal/reactivation,
  workspace-scoped session revocation, and step-up-protected atomic operational
  ownership transfer with last-owner safety;
- authenticated self display-name update, OWNER/ADMIN active-workspace rename,
  and protected non-owner self-leave;
- executable HTTP and repository tenant-isolation matrices for every currently
  implemented tenant-owned surface;
- repository foundation gates for strict full-project type checking,
  deterministic local seeding, OpenAPI drift, architecture/table ownership,
  non-mutating CI, and Docker E2E;
- provider-neutral durable mail delivery with a Resend API adapter;
- origin checks, authentication rate limiting, compromised-password screening;
- audit records, request IDs, Zod transport validation, and OpenAPI generation.

The repository does not contain a customer-facing product module, provider SDK,
prompt, retrieval pipeline, generated-output policy, product UI, billing system,
job system, file system, or production deployment topology.

## Product boundary

### Platform Core owns

- stable principals, authentication methods, verification/reset, and sessions;
- users, organizations, workspaces, memberships, tenant context, and base RBAC;
- audit, configuration validation, stable errors, request correlation, and
  reusable persistence/transaction boundaries;
- generic billing, subscriptions, entitlements, credits, usage, jobs, files,
  notifications, API keys, or webhooks only after an explicit platform need or
  a second proven product consumer.

### A downstream product repository owns

- its product domain model, policies, use cases, persistence, APIs, and UI;
- product-specific external-provider adapters and routing policy;
- prompts, generated-output validation, retrieval policy, evaluation fixtures,
  pricing, usage normalization, and product analytics;
- product files, jobs, webhooks, and events unless they consume an existing
  generic Core contract.

Core must never import a downstream product module, query its tables, or encode
its roadmap. A downstream product may depend on narrow public Core contracts.

## Architecture style

- Keep one deployable modular monolith until measurable extraction criteria are
  met.
- Organize capabilities as vertical, feature-first modules.
- Keep dependency direction presentation -> application -> domain, with
  infrastructure implementing inward-facing ports.
- Keep domain code free of NestJS, Prisma, HTTP, Redis, queue, and provider SDK
  types.
- Let a feature application service method own its transaction boundary.
- Publish committed facts through an outbox or equivalent reliable handoff when
  asynchronous effects are required.
- Avoid internal HTTP between modules in the monolith.
- Keep the shared kernel limited to stable primitives such as identifiers,
  Money, Clock, Result, Error, and event envelopes.
- Add an abstraction for a real external boundary, volatile policy, or second
  proven consumer, not for speculative reuse.

## Repository structure

### Current structure

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
    authentication/
    identity/
    users/
    organizations/
    workspaces/
    memberships/
    audit/
prisma/
test/
```

Until an explicit foundation change adopts a monorepo, downstream product
modules belong under `src/products/<capability>` in their own repository.

### Target structure

The accepted long-term direction is pnpm workspaces and Turborepo, while
retaining one modular-monolith backend:

```text
apps/
  api/
  web/
  worker/
packages/
  platform-core/
  database/
  contracts/
  config/
```

Do not perform this reorganization as incidental work. Preserve current package
commands until the explicit migration is implemented and verified. ADR-0010
retains the single-package structure until multiple real packages or
applications, stable shared consumers, a downstream release strategy, private
database ownership, and measured task-graph/cache pressure justify migration.

## Core module map

### Implemented foundation

- Identity: stable principals and authentication methods.
- Authentication: registration, verification/reset, login, password change,
  opaque sessions, and revocation.
- Users: profile data and authenticated self display-name updates.
- Organizations: commercial ownership boundary.
- Workspaces: operational tenant boundary and OWNER/ADMIN active-workspace
  rename.
- Memberships: users connected to workspaces, invitation lifecycle,
  administration, protected self-leave, soft removal/reactivation, and
  workspace ownership safety.
- Authorization: explicit deny-by-default route admission and authenticated
  active-user policy plus base membership invitation permissions.
- Multi-workspace session selection: bounded credentialed choices, actor-only
  membership listing, and audited per-session workspace switching.
- Audit: append-oriented sensitive-action records.
- Configuration, persistence, Redis, and shared primitives.
- Repository foundation: strict type checking, collision-safe local seed,
  committed OpenAPI contract, executable architecture ownership, and CI.

### Planned foundation

- Organization commercial ownership transfer and multi-workspace policy.
- User deactivation/deletion and workspace archive/delete/create lifecycle
  policy, including recovery paths.

### Optional reusable capability packs

Add only when explicitly required:

- Subscription, billing, feature access, credits, and usage metering.
- Job management, outbox dispatch, notifications, and file management.
- Feature flags, API keys, and outbound webhooks.
- External capability gateways and provider registries after multiple products
  prove the shared contract.

An optional capability pack is still Core only when its contract is
product-neutral. Product policy stays downstream.

## Data ownership and persistence

- Give one module ownership of each table and business rule.
- Use stable IDs and public contracts across module boundaries.
- Store business timestamps as UTC `timestamptz`.
- Put non-null `workspace_id` on tenant-owned records and include workspace scope
  in unique constraints and leading indexes.
- Keep repositories scoped by trusted tenant context.
- Use JSONB for flexible metadata, not queryable core state.
- Keep transaction boundaries in feature application service methods.
- Write durable state and its outbox record in the same transaction.
- Use real PostgreSQL for persistence and transaction verification.

During development, `prisma/schema.prisma` is the source of truth and schema
changes use `prisma db push`. Do not create migration history until the user
explicitly announces the production transition. At that transition, use
reviewed forward-only expand -> deploy -> backfill -> contract migrations.

## Tenancy and authorization

- `Organization` is the commercial boundary.
- `Workspace` is the operational tenant and authorization boundary.
- Resolve the actor from a verified session or API key, validate workspace
  membership server-side, and inject immutable tenant context.
- Never trust a route ID, UI state, or arbitrary client header as authorization.
- Deny by default and authorize both the action and resource.
- Scope database access, cache keys, files, jobs, webhooks, audit, and external
  requests by trusted `workspaceId`.
- Add positive and negative tenant A/B tests for every tenant-owned surface.
- PostgreSQL RLS may provide defense in depth but does not replace application
  authorization.

## Identity and session security

- Use opaque, rotatable server sessions in Secure, HttpOnly, SameSite cookies.
- PostgreSQL is authoritative for revocation; Redis is a disposable lookup
  cache and its cleanup is best effort.
- Hash session, verification, reset, invitation, and API-key secrets at rest.
- Use generic responses for credential, verification, invitation, and reset
  operations where enumeration is possible.
- Apply exact-origin validation, trusted-proxy configuration, and bounded
  rate limits before expensive password work.
- Screen new passwords before hashing without transmitting plaintext or a full
  password digest.
- Audit sensitive lifecycle and privileged operations without logging secrets
  or personally identifiable data.

## Commercial and metered capabilities

Billing, credits, usage, and entitlements are optional reusable capabilities,
not automatic platform scope.

When added:

- use integer micros for money and credits;
- keep ledgers append-only and auditable;
- make grants, reserve, commit, release, refund, and webhook processing
  transactional and idempotent;
- handle webhook signature verification, replay, deduplication, and
  out-of-order events;
- version plans, entitlements, supplier prices, customer charges, and policy;
- add concurrency and reconciliation tests.

Product-specific pricing and usage policy remain downstream.

## External provider extensions

Platform Core contains no product-provider integration by default.

A downstream product that uses an external capability provider must:

- define a narrow, provider-neutral inward-facing port;
- keep SDK types, raw errors, and credentials inside infrastructure adapters;
- enforce allow-lists, timeout, cancellation, bounded retry, budgets, and
  output validation;
- separate supplier usage/cost from customer usage/charge;
- keep sensitive request/response content out of normal logs;
- use deterministic fakes for ordinary tests and product-owned evaluation data
  for generated-output quality;
- require typed tools, permissions, step limits, loop detection, audit, and
  human approval for risky automated actions.

Promote a provider gateway into Platform Core only after at least two products
prove a stable shared contract.

## Jobs, files, and integration events

- Queue payloads contain stable identifiers and minimal parameters, not raw
  secrets or file contents.
- Use deterministic job IDs or database uniqueness for deduplication.
- Make handlers idempotent after redelivery and classify retryable versus
  permanent failures.
- Persist durable job state and coarse progress outside Redis.
- Support bounded retry, cancellation, timeout, heartbeat, failed state, and
  audited replay where applicable.
- Keep object storage private and tenant-scoped.
- Use short-lived presigned URLs and verify object existence, size, checksum,
  MIME magic bytes, extension, and ownership before finalization.
- Revoke file access immediately and perform cleanup idempotently.
- Include event version, workspace, stable IDs, occurred-at, correlation, and
  causation IDs in integration events.

## API and observability

- Use versioned resource-oriented REST documented through OpenAPI.
- Use SSE only for demonstrated server-to-client streaming requirements.
- Keep transport schemas separate from domain objects.
- Use stable error codes and safe messages.
- Require idempotency for costly creates, billing operations, and webhooks.
- Use cursor pagination and allow-listed filtering/sorting.
- Propagate sanitized request and correlation IDs.
- Emit structured logs, metrics, and traces with redaction.
- Never expose stacks, SQL, credentials, raw provider payloads, or sensitive
  content in responses or ordinary logs.

## Verification and definition of done

- Unit-test domain policies and application decisions.
- Integration-test repositories, transactions, Redis, queues, storage, and
  external adapters when those surfaces change.
- End-to-end-test changed API flows with real authentication and tenant context.
- Contract-test OpenAPI/transport schemas, external adapters, events, and
  webhook signatures.
- Add tenant-isolation tests for every tenant-owned repository and endpoint.
- Add concurrency and replay tests for financial and asynchronous state.
- Run only commands present in `package.json` and record exact results.
- Run `pnpm run check:deprecated` after TypeScript or dependency changes.
- Treat ownership, contract, tenancy, security, data impact, observability,
  tests, rollout, and rollback as part of the change.

## Deployment baseline

- Keep local development reproducible with Docker Compose.
- Build immutable application images and promote the same image through
  environments.
- Keep stateful production data in reviewed PostgreSQL, Redis, and private
  object-storage services.
- Validate configuration and secrets at startup without exposing them.
- Add health and readiness gates, security headers, backups, restore drills,
  backward-compatible rollout, and rollback runbooks before production.
- Define RPO, RTO, SLOs, capacity, provider quotas, and retention before launch.
- Do not adopt microservices, Kubernetes, multi-region, or dedicated-tenant
  topology without measurable need and an ADR.

Repository-enforced progress (ADR-0011 and ADR-0012) now includes validated
production runtime configuration, exact credentialed CORS, session/security
headers, stable liveness/readiness, structured correlation and vendor-neutral
metrics hooks, a digest-pinned non-root application image, an encrypted
PostgreSQL mail outbox with bounded retries, and operator runbook/gates. These
controls do not resolve the external launch decisions below and do not announce
the production database migration transition.

## Platform roadmap

1. Complete tenant foundation: organization commercial ownership policy and
   account/workspace terminal-state and recovery policy.
2. Maintain the repository foundation gates accepted in ADR-0010 and reassess
   pnpm workspaces/Turborepo only when its explicit triggers are met.
3. Add optional reusable capabilities only when a downstream product proves the
   need.
4. Prepare production operations: deployment, observability, privacy,
   backup/restore, security testing, and migration transition.

No named product appears in the Platform Core roadmap. Each downstream product
repository owns its own roadmap.

## Accepted decisions

- NestJS 11 with the Express adapter.
- PostgreSQL and Prisma in infrastructure.
- Redis as disposable infrastructure for sessions, rate limits, and future
  queues, with durable state outside Redis.
- Modular monolith with shared database/shared schema and logical module data
  ownership.
- Workspace-scoped row isolation.
- Opaque server sessions.
- Authenticated password changes revoke all existing sessions, rotate the
  current session token, and preserve its absolute expiry.
- Multi-workspace login uses an explicit validated selector when more than one
  membership exists; a real session workspace switch rotates the opaque token,
  preserves absolute expiry, and audits both workspace scopes.
- Membership administration uses active-row lifecycle state, workspace-scoped
  session revocation, lower-role management, and an explicit current-password
  confirmed owner replacement. Workspace operational ownership does not mutate
  organization commercial ownership.
- Bounded lifecycle operations support authenticated self display-name update,
  OWNER/ADMIN active-workspace rename, and protected non-owner self-leave while
  deferring account deactivation and workspace archival until ownership and
  recovery policies are defined.
- Current tenant-owned HTTP and repository surfaces maintain executable
  positive and tenant A/B negative matrices; every future tenant surface must
  extend both matrices in the same change.
- Every Nest route declares public, context-authenticated, or
  application-authenticated admission; unclassified routes are denied, and
  context-authenticated tenant routes require active users by default.
- REST/OpenAPI, with SSE only for demonstrated streaming needs.
- pnpm workspaces and Turborepo as an explicit long-term repository target.
- One root package until ADR-0010's package-consumer and measured task-graph
  triggers justify a separately approved migration.
- Product-neutral Platform Core with downstream product repositories.

## Open decisions

Resolve these only when their phase begins:

- exact production ingress/trusted-proxy addresses, origins/CORS topology, and
  approved SameSite policy within the enforced secure configuration boundary;
- production Resend sender-domain authentication, quotas, and
  acceptance-ambiguity policy (reliable encrypted retry is implemented);
- organization commercial ownership transfer across multiple workspaces;
- whether and when to enable PostgreSQL RLS;
- billing provider, plan, credit, entitlement, and refund policy if commercial
  capabilities are added;
- managed infrastructure providers, region, sizing, secret manager, and
  observability tenancy;
- retention, data deletion, RPO/RTO, SLOs, and capacity budgets;
- the release and compatibility strategy used by downstream product
  repositories to consume Platform Core updates.
