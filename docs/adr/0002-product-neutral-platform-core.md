# ADR-0002: Keep this repository product-neutral

- Status: Accepted
- Date: 2026-08-08
- Owners: Nexora engineering
- Supersedes: Product-specific roadmap portions of the original AI SaaS baseline
- Related issues/changes: Platform Core extraction boundary

## Context

The repository has implemented reusable authentication, identity, user,
organization, workspace, membership, persistence, Redis, and audit foundations.
It has not implemented a customer-facing product, provider SDK, prompt,
retrieval pipeline, product schema, or product UI.

The previous architecture baseline prescribed named products and a
product-specific delivery roadmap. The repository will instead serve as a clean
base from which independent product repositories are created. A stable boundary
is needed before downstream products begin so Core does not accumulate product
policy or depend on any one product.

## Decision drivers

- Reuse the security- and tenancy-sensitive foundation across different
  products.
- Keep each product's domain, providers, prompts, evaluation data, UI, and
  roadmap independent.
- Prevent Core from becoming coupled to the first downstream product.
- Preserve the existing runtime behavior and verified authentication work.
- Allow shared capabilities to be promoted only after proven reuse.

## Considered options

### A. Keep named products in this repository

This keeps the original roadmap intact but couples the base repository to one
product sequence and makes later product forks carry unrelated guidance.

### B. Keep one repository with multiple product modules

This allows direct sharing but creates a shared release lifecycle and increases
the chance that Core depends on product data or policies.

### C. Make this repository product-neutral and create downstream repositories

This preserves a focused Core boundary while letting each product own its
roadmap and integrations. Shared changes require deliberate release and update
coordination.

## Decision

Choose option C.

This repository is Nexora Platform Core. It owns reusable platform capabilities
and contains no named customer product. Downstream product repositories start
from a reviewed Core revision and may add product modules that depend on Core's
public application contracts.

Core must not import downstream product modules, query their tables, encode
their workflow, or contain their provider-specific behavior, prompts,
evaluation data, pricing policy, or UI. A capability may be promoted from a
product repository into Core only after a second proven consumer or an explicit
platform requirement and architecture review.

## Consequences

### Positive

- The current repository remains a clean reusable foundation.
- Downstream products can evolve and deploy independently.
- Product-specific dependencies and sensitive policies stay out of Core.
- Cross-module contracts and ownership remain explicit.

### Negative and tradeoffs

- Core changes need an explicit release and downstream update strategy.
- Similar code may remain duplicated until a second consumer proves a stable
  abstraction.
- Each product repository must maintain its own guidance, roadmap, evaluation,
  and provider policy.

## Compatibility and migration

This decision changes repository identity, documentation, OpenAPI display
title, and the outbound password-screening user agent. Existing API routes,
session-cookie names, database schema, persisted data, Compose database/volume
names, and environment contracts are unchanged. The package name changes from
`nexora-ai` to `nexora-platform-core`; it is private and is not currently
published. Previous context-specific weak-password entries remain and a
Platform Core-specific entry is added.

The original product-specific baseline is replaced with
`docs/architecture/platform-core-baseline.md`. Repository guidance, skill
references, and read-only specialist agents must point to the new baseline.
The downstream-product guide records inherited identifiers that require
deliberate compatibility handling in derived repositories.

## Security, privacy, and tenancy

Existing authentication and tenant controls remain in Core. Product
repositories must consume trusted workspace context and must not weaken Core
authorization, session, secret, audit, or privacy invariants. Product content,
provider payloads, prompts, and evaluation data do not belong in this base.

## Reliability and observability

There is no API-route, session, persistence, or data-path change. Existing
build, unit, end-to-end, and deprecation checks verify compatibility. Future
downstream update procedures must document version compatibility, rollout, and
rollback.

## Verification

- Search the repository for obsolete baseline paths and named product roadmap
  references.
- Verify the package and documentation identify the repository as Platform Core.
- Run lint, unit tests, end-to-end tests, build, and deprecated-API audit.
- Review the final diff for runtime or schema changes.

## Rollout and rollback

Commit this boundary change before creating a downstream product repository.
Rollback consists of reverting this documentation and repository-identity
commit; runtime and data rollback are unnecessary.

## Follow-up work

- [ ] Define the release/tagging convention for reviewed Platform Core versions.
- [ ] Define how downstream repositories consume compatible Core updates.
- [ ] Give each downstream product its own mission, architecture supplement,
      product module catalog, evaluation policy, and roadmap.
