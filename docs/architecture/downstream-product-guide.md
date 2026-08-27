# Create a downstream product from Nexora Platform Core

Use this checklist when creating a separate customer-facing product repository
from Platform Core.

## Start from a reviewed base

1. Select a reviewed Platform Core commit or release tag.
2. Create an independent repository from that revision.
3. Record the consumed Core revision in product release metadata.
4. Define how compatible Core updates will be reviewed, integrated, tested,
   rolled out, and rolled back.

## Define the product boundary

- Rename the package and write a product-specific mission.
- Add a product architecture supplement and module catalog.
- Keep product modules under `src/products/<capability>` until an explicit
  monorepo migration is approved.
- Keep product schema, workflows, APIs, UI, providers, prompts, retrieval,
  evaluations, pricing, usage policy, and analytics downstream.
- Consume Platform Core only through public application contracts.
- Add an ADR for each provider category or changed Core decision.

## Review inherited runtime identity

Change these deliberately, not through blind search-and-replace:

- npm package name and README title;
- OpenAPI title and public documentation;
- application Origin/CORS configuration and deployment hostnames;
- HTTP user-agent strings used with external services;
- product-specific password policy, when it differs from Core;
- test identities, fixtures, and example payloads.

Preserve or migrate these with compatibility planning:

- session-cookie name: renaming it invalidates existing browser sessions;
- Compose database, user, and volume names: renaming a volume can make existing
  local data appear missing;
- database URLs, Redis URLs, ports, and persisted environment configuration;
- public API routes and stable error codes;
- webhook secrets, idempotency namespaces, cache-key prefixes, and callback
  URLs after those capabilities exist.

## Protect Core boundaries

- Do not query Core-owned tables from product modules.
- Do not inject `PrismaService` or `DatabaseContext` directly into product
  modules; consume an owning module's public application contract.
- Keep Core independent of every product module.
- Keep the current registration flow as the default onboarding policy unless
  the product explicitly designs and tests a replacement.
- Add an architecture dependency test before the first product module.
- Add tenant A/B tests for each product-owned repository and endpoint.

## Minimum product repository guidance

The downstream repository should contain:

- an `AGENTS.md` that identifies the product outcome and preserves Core
  invariants;
- a product architecture supplement and module catalog;
- product-specific security, privacy, retention, and provider-data policy;
- deterministic provider fakes and product-owned evaluation fixtures;
- an initial vertical-slice roadmap and explicit non-goals;
- deployment, observability, rollback, and Core-update procedures.
