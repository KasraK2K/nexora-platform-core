# ADR-0014: Conventional NestJS module structure

- Status: Superseded by ADR-0015
- Date: 2026-08-25
- Owners: Nexora Platform Core maintainers
- Supersedes: None
- Related decisions: ADR-0010

## Context

Platform Core is a single NestJS modular monolith, but its source tree currently
places most controllers below `presentation/`, application entry points below
`application/`, and a root infrastructure module beside the feature folders.
The boundaries are deliberate, but the outer shape is unfamiliar to many
NestJS developers. The old module placement also made Nest CLI parent discovery
ambiguous, so normal generators could register files with an unintended module.

The repository needs one obvious entry point per capability and predictable
Nest CLI behavior without weakening authorization, tenant isolation, data
ownership, transaction boundaries, or provider isolation.

## Decision drivers

- Make the first files a NestJS developer sees use familiar names and locations.
- Restore deterministic behavior for the installed NestJS CLI generators.
- Remove duplicate facade and one-class-per-action application layers where a
  cohesive service expresses the same boundary more clearly.
- Preserve all existing HTTP, persistence, security, and operational behavior.

## Considered options

### Keep the existing layered tree

This keeps current imports stable but leaves the onboarding and CLI discovery
problems unresolved.

### Flatten every feature to controller, service, and repository

This is the smallest-looking tree, but it would hide domain policies, external
adapters, transaction ownership, and the cycle-breaking session and
authorization modules inside overly broad services.

### Use a conventional NestJS shell with protected internals

Each capability receives an obvious root module and, where applicable, root
controllers and cohesive services. Repository ports, domain policies, and
infrastructure adapters remain explicit when they protect a real boundary.

## Decision

Adopt the conventional NestJS shell with protected internals.

- Platform capabilities live under `src/modules/<feature>`.
- Every feature directory contains exactly one public
  `<feature>.module.ts`. A secondary Nest module must live in its own named
  subdirectory.
- Small features place `<feature>.controller.ts` and `<feature>.service.ts` at
  the feature root. Complex features may use `controllers/` and `services/`,
  while retaining one obvious root module.
- Root controllers are presentation adapters. Root services and files below
  `services/` are application services and own orchestration and transactions.
- Request schemas and inferred transport types live in `dto/` and continue to
  use Zod. Prisma models are not duplicated as Nest entity classes.
- Repository interfaces and their single injection tokens live in
  `repositories/`. Prisma and provider implementations remain under the owning
  feature's `infrastructure/` directory.
- Framework-independent policies and value objects remain under `domain/`.
- Shared stable primitives live in `src/common`; application configuration,
  PostgreSQL, transactions, and Redis wiring live in `src/config` and
  `src/infrastructure`.
- `src/modules` contains no parent module. Generating
  `modules/<feature>` therefore registers the new feature with `AppModule`.
- Cross-module code imports only an owning module and its explicitly exported
  service contracts. Repositories and adapters remain private.
- The built-in Nest CLI remains the only generator. No custom schematic or
  generated CRUD resource convention is introduced.

## Consequences

### Positive

- Feature entry points follow familiar NestJS naming.
- Module, controller, and service generation resolves to the intended module.
- Contributors can trace controller to service to repository without learning
  a repository-specific facade vocabulary first.
- Complex security and persistence boundaries stay explicit.

### Negative and tradeoffs

- TypeScript source paths and several public class names change atomically.
- Authentication and Memberships still need more than one service and a small
  number of nested modules because their workflows and dependency graph are
  materially different from simple CRUD.
- Architecture tests must understand suffix-based root layers in addition to
  directory-based layers.

## Compatibility and migration

The migration changes internal TypeScript imports and Nest provider names. The
package is private and no downstream source-import consumer is declared, so no
compatibility aliases are retained.

HTTP paths, methods, DTO wire fields, OpenAPI output, status codes, stable error
codes, cookie behavior, environment variables, cache keys, database schema,
audit actions, provider behavior, and mail-outbox identifiers remain unchanged.
The structural move is completed before services are consolidated so failures
can be attributed to one kind of change at a time.

## Security, privacy, and tenancy

Route admission remains deny by default and is still installed exactly once as
the global application guard. Controllers continue to use explicit route
metadata and Zod validation. Services retain server-resolved actor and
workspace context, permission and resource checks, hashed token storage,
serializable transaction boundaries, audit writes, and post-commit effects.

The Authentication session-state and Authorization policy modules remain as
nested cycle breakers. Repository implementations stay private and scoped to
their owning module. The Mail outbox keeps encryption, fenced claims,
idempotency, bounded retries, and at-least-once delivery semantics.

## Reliability and observability

The refactor does not change retry, timeout, idempotency, logging, metrics,
correlation, or error-sanitization behavior. Each module move is independently
reviewable and revertible. No data rollback is required because the Prisma
schema and stored data are unchanged.

## Verification

- Architecture tests enforce naming, one module per directory, inward
  dependencies, public-service-only cross-module access, and Prisma ownership.
- Nest CLI dry-run checks prove new modules target `AppModule` and new
  controllers/services target their owning feature module.
- OpenAPI contract and Prisma schema remain unchanged.
- Unit and end-to-end coverage verifies authentication, route admission,
  tenancy, transactions, sessions, membership ownership, and mail outbox
  behavior.
- Formatting, lint, typecheck, deprecated API, build, documentation, and
  contract gates pass after the migration.

## Rollout and rollback

Migrate the mechanical tree first, then simple feature services, then
Memberships, Authentication, and Authorization. Keep every tranche revertible.
Rollback is a code revert; do not reset PostgreSQL, Redis, or outbox data for a
source-layout rollback.

## Follow-up work

- [ ] Reassess a custom feature schematic only after repeated, measured need.
- [ ] Reassess the monorepo target only when ADR-0010 triggers are met.
