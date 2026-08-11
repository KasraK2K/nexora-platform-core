# ADR-0010: Retain the single-package modular monolith with executable foundation gates

- Status: Accepted
- Date: 2026-08-11
- Owners: Nexora Platform Core
- Supersedes: None
- Related issues/changes: Repository foundation

## Context

The accepted long-term repository direction is pnpm workspaces and Turborepo,
while preserving one deployable modular-monolith backend. The live repository
has one private package, one NestJS source root, one lockfile importer, and no
independently built web, worker, package, or product source tree. Turborepo is
not installed or configured. Moving the current source into placeholder
`apps/` and `packages/` directories would add topology without a real package
boundary or build graph.

The repository also lacked a non-emitting full-project type check, deterministic
development seed, committed REST contract, architecture dependency gate, and
CI. The existing lint command mutates files, so it was unsuitable as a CI gate.
The E2E command loaded `.env.test` without overriding ambient variables even
though the suite deletes all Core tables and flushes test Redis.

## Decision drivers

- Preserve the verified single-deployable NestJS backend.
- Avoid speculative packages, applications, or shared contracts.
- Make the existing module and product boundaries executable before products
  are derived from Core.
- Detect type, public-contract, ownership, and dependency drift in CI.
- Keep development schema work on `prisma db push` without migration history.
- Fail closed before local seed, schema synchronization, or E2E cleanup can
  target an unexpected database or Redis instance.

## Considered options

### Keep one package and add foundation gates

This preserves the current deployment and commands while making repository
invariants executable. It does not provide cross-package task scheduling or
remote cache benefits because no cross-package graph exists.

### Adopt pnpm workspaces without Turborepo

This is appropriate once at least two real packages or applications need
independent manifests, ownership, and build boundaries. It is premature while
the only importer would remain the root package.

### Adopt pnpm workspaces and Turborepo now

This implements the documented target immediately, but requires placeholder
packages or an incidental source move. It adds cache and task-graph policy
without measured CI pressure or multiple real tasks to coordinate.

## Decision

Retain the current single-package NestJS modular monolith. `pnpm-workspace.yaml`
continues to define pnpm lifecycle-build policy, not package topology.
Turborepo remains the accepted long-term orchestration target but is not a
current dependency.

Approve pnpm workspace migration only when all of these triggers are met:

1. At least two real Core-owned packages or independently built/deployed
   applications exist; empty scaffolds do not count.
2. A stable contract has at least two real package consumers with named
   ownership, compatibility, and versioning rules.
3. The downstream Core release, update, and rollback strategy is decided.
4. Prisma and database infrastructure remain private and no contracts expose
   ORM types.
5. Existing build, lint, unit, E2E, Prisma generation, Compose, and production
   start behavior have a verified compatibility and rollback plan.
6. Turborepo is justified separately by a measured task-graph or CI-cache
   problem; multiple packages alone justify pnpm workspaces, not Turbo.
7. A superseding ADR defines deployables, package ownership, schema/client
   ownership, caching, rollout, and rollback before files move.

The repository enables TypeScript `strict` mode plus fallthrough, implicit
return, and override checks. The non-emitting type check includes production
and test code. `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`
remain deferred because they require a separate broad cleanup; they must not be
enabled through `any`, unchecked assertions, or non-null assertions.

OpenAPI generation uses the same document factory as runtime. A canonical,
key-sorted `docs/reference/openapi.json` is committed; check mode regenerates in
memory and fails on any drift. Architecture tests parse TypeScript imports and
Prisma delegate use to enforce inward layering, Core independence from products,
product access only through Core application contracts, and table delegate
ownership. Existing cross-presentation composition and two known boundary debts
are exact allow-list entries; new exceptions require review.

Prisma seed execution remains explicit. The product-neutral seed uses fixed
UUIDs and `example.invalid` data, writes no passwords, sessions, tokens, PII,
provider data, or product policy, and converges through collision-checked
upserts in a serializable transaction. Local mutation policy accepts only the
committed loopback development/test database names, users, and ports. E2E
forces the test environment before schema synchronization and cleanup. Compose
publishes development and test ports only on loopback.

CI uses the locked pnpm version and frozen lockfile. Its non-mutating quality
job checks formatting, lint, types, deprecated APIs, contract drift,
architecture, build, and unit tests. A dependent Docker E2E job verifies schema
push, two repeat seed runs, API E2E tests, and always tears down test services.

## Consequences

### Positive

- No source move, package split, runtime topology, or deployment behavior
  changes.
- Type regressions in tests can no longer hide behind the build exclusion.
- Public REST drift and architecture violations fail before merge.
- Products cannot import raw Core persistence through an unnoticed source
  dependency.
- Local destructive tooling rejects ambient remote or production targets.

### Negative and tradeoffs

- Import and delegate tests are static controls, not a database authorization
  boundary. The generated Prisma client still exposes the shared schema inside
  Core.
- The committed OpenAPI document reflects current Swagger annotations; some
  existing response descriptions still need richer schemas.
- A future package migration will move paths and revise scripts after its
  triggers are met.
- Strict optional-property and indexed-access checks remain incomplete.

## Compatibility and migration

There is no Prisma schema change, migration history, public route change,
session-cookie change, or persisted-data migration. `prisma/schema.prisma`
remains the development source of truth and `prisma db push` remains the schema
synchronization mechanism. New commands and CI gates are additive. Loopback
port binding preserves host-local access while removing LAN exposure.

## Security, privacy, and tenancy

The seed contains synthetic public fixture values only and cannot run against
production, remote hosts, or unexpected local database identities. It creates
one Core tenant graph without credentials or tokens. Architecture gates deny
Core-to-product imports and deny product access to Prisma, Core persistence,
and Core infrastructure. Existing tenant-isolation matrices remain unchanged.

## Reliability and observability

Seed collisions abort the serializable transaction without adopting unrelated
rows. Contract generation does not connect to PostgreSQL, Redis, SMTP, or a
running HTTP server. CI E2E cleanup runs even after failure. Tool output reports
only approved purpose or artifact paths and never prints connection URLs.

## Verification

- Generate and check the canonical OpenAPI artifact twice.
- Run full-project type checking under the accepted strictness batch.
- Run architecture tests, formatting check, non-mutating lint, deprecated API
  audit, build, and unit tests.
- Run the local target-policy tests.
- On isolated Docker test services, push the schema, run the seed twice, and
  execute E2E tests.
- Run `git diff --check` and refresh Graphify.

## Rollout and rollback

Adopt the gates together so CI never references a missing command or artifact.
Rollback removes the workflow, scripts, seed configuration, snapshot, and
strictness flags. It does not require data rollback; seeded rows may be removed
manually only from an approved local database. A future monorepo migration must
supersede this ADR before moving source.

## Follow-up work

- [ ] Enable `exactOptionalPropertyTypes` in a bounded cleanup.
- [ ] Enable `noUncheckedIndexedAccess` in a bounded cleanup.
- [ ] Replace exact cross-module debt allowances with declared public module
      entrypoints, including Authentication's Identity domain-error import and
      Authentication domain's Membership role import.
- [ ] Add complete response and stable-error schemas to every OpenAPI operation.
- [ ] Reassess pnpm workspaces and Turborepo only when the recorded triggers are
      met.
