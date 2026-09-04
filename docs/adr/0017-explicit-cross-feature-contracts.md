# ADR-0017: Explicit cross-feature contracts

- Status: Accepted
- Date: 2026-09-04
- Owners: Nexora Platform Core maintainers
- Supersedes: None
- Related decisions: ADR-0005, ADR-0015, ADR-0016

## Context

ADR-0015 makes an exported feature service the normal cross-module application
contract. The current HTTP security boundary also has a smaller set of
intentional cross-feature imports: controllers use Authentication's resolved
request-context decorator, Authorization composes Authentication's context and
origin guards, controllers declare Authorization metadata, and feature services
reuse Authorization's pure role policy and stable denial error.

These imports preserve clear ownership and avoid forwarding services or a broad
shared framework package. They were enforced by a source-path allow-list, but
the exception and its dependency limits were not recorded as an accepted
architecture decision. Public session and membership result shapes also
originated in private repository files even though consumers reached them
through service re-exports.

## Decision drivers

- Keep repositories and persistence details private to their owning feature.
- Preserve one authoritative route-admission and authenticated-context path.
- Avoid forwarding facades and a generic cross-feature contracts package.
- Make every exception narrow, discoverable, and mechanically enforced.

## Considered options

### Require every cross-feature dependency to be a service

This is uniform, but decorators, guards, metadata, pure policies, and stable
errors are not application-service workflows. Wrapping them would add
indirection and obscure their actual NestJS and policy roles.

### Move the contracts into a shared package

This shortens some imports but weakens feature ownership and invites unrelated
transport and business contracts into the shared kernel.

### Keep an exact feature-owned allow-list

This preserves direct, intention-revealing imports while preventing the narrow
exception from becoming general access to another feature's implementation.

## Decision

Cross-feature runtime workflows continue to use an imported module and its
exported focused service. The only non-module, non-service cross-feature source
contracts are these exact feature-owned files:

- Authentication's
  `decorators/authenticated-request-context.decorator.ts`,
  `guards/authenticated-request-context.guard.ts`, and
  `guards/trusted-origin.guard.ts`;
- Authorization's `route-admission.decorator.ts`, `authorization.policy.ts`,
  and `authorization.errors.ts`.

The Authentication contracts expose server-resolved request context and the
two guards composed by the single global route-admission guard. The
Authorization contracts expose route metadata, a dependency-free permission
policy, derived role types, and stable authorization denial. They remain owned
by their feature and are not a general shared kernel.

These exceptional contract files must not import Prisma, infrastructure,
repositories, cache or rate-limit implementations, provider or worker code, or
downstream product code. Architecture tests enforce both the exact allow-list
and those direct dependency restrictions. Adding another exceptional file or
moving one requires an explicit update to this decision and its test.

Feature-level public result types live in `<feature>.types.ts` rather than a
private repository. `SessionsService` and `MembershipsService` continue to
re-export their established types, so consumers keep importing the public
service path. Persistence-only record and projection types remain private to
the repository file.

## Consequences

### Positive

- Public contracts no longer make a private repository look like an API.
- HTTP trust and authorization ownership stay visible at each import.
- Tests reject accidental expansion into persistence, providers, or products.
- Existing service consumers retain their current import paths.

### Negative and tradeoffs

- The architecture test contains a small explicit source-path allow-list.
- A deliberate new decorator, guard, policy, or stable error contract requires
  an ADR and test update instead of becoming public implicitly.

## Compatibility and migration

This is a TypeScript organization and architecture-guard change only. HTTP and
OpenAPI contracts, Prisma schema and data, cookies, tokens, Redis keys, audit
actions, and runtime behavior do not change. Existing service-level type
imports remain compatible. Rollback is a source revert with no data movement.

## Security, privacy, and tenancy

Authentication remains the owner of opaque-cookie resolution, exact-origin
validation, and immutable server-resolved request context. Authorization
remains the owner of deny-by-default route metadata and coarse permission
policy. The allow-list does not permit client-derived tenant authority,
cross-feature table access, secrets, raw provider data, or product policy.
Sensitive writes must still revalidate durable session, membership, and
resource state inside the owning use case.

## Reliability and observability

The decision adds no I/O, retry, timeout, job, provider, logging, metric, or
trace behavior. Existing failure isolation and stable authorization errors are
unchanged.

## Verification

- Architecture tests compare actual exceptional cross-feature imports with the
  exact accepted allow-list.
- Architecture tests reject unsafe direct dependencies from those contracts.
- Architecture tests confirm the session and membership public types no longer
  originate in private repositories.
- Typecheck and existing architecture tests confirm service re-export
  compatibility and the acyclic Nest module graph.

## Rollout and rollback

Ship the type moves, documentation, and architecture guards together. Rollback
is a source revert; no deployment sequencing, database synchronization, cache
flush, or session invalidation is required.

## Follow-up work

- [ ] Revisit the allow-list only when a concrete second contract cannot be
      expressed cleanly through an existing focused service.
