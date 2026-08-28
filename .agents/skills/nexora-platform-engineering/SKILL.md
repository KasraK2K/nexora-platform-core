---
name: nexora-platform-engineering
description: Plan, design, implement, diagnose, or review Nexora Platform Core and its downstream product extension boundary. Use for NestJS modules, APIs, persistence, tenancy, authentication, authorization, billing, credits, usage, jobs, files, external-provider boundaries, frontend integration, deployment, ADRs, repository forks, or architecture-sensitive refactors. Keep this base repository product-neutral; product modules and product policy belong in downstream repositories.
---

# Nexora Platform Engineering

Use the product-neutral Platform Core baseline without confusing planned
architecture with implemented code or placing downstream product behavior in
this repository.

## Load the right context

1. Read the applicable `AGENTS.md`.
2. Inspect the repository, `package.json`, lockfile, tests, schema, and active
   configuration before making claims.
3. Read only the relevant sections of
   [the Platform Core baseline](../../../docs/architecture/platform-core-baseline.md).
4. Read [module-catalog.md](references/module-catalog.md) for ownership,
   contracts, dependencies, tables, permissions, and the Core/product boundary.
5. Read [change-checklists.md](references/change-checklists.md) for planning,
   implementation, or review.
6. Use [the ADR template](../../../docs/adr/0000-template.md) when a material
   decision changes architecture or the product boundary.

## Preserve current truth

- This repository is Nexora Platform Core. It contains no customer-facing
  product module, provider SDK, prompt, retrieval pipeline, evaluation set, or
  product UI.
- Treat the target monorepo, expanded role/permission catalog, billing, jobs,
  files, frontend, provider gateways, and external observability stack as
  planned until they exist and are configured.
- Use current verified scripts and test tooling. Do not invent commands or
  claim planned gates passed.
- Verify changed third-party APIs against installed versions, declarations,
  the lockfile, and official version-matched documentation.
- Make foundation migrations explicit and preserve working behavior unless the
  request authorizes a change.

## Classify the repository boundary first

### Platform Core

A capability belongs here when it is a stable cross-product concern, an
unavoidable platform boundary, or has at least two proven product consumers.
Examples include users, authentication, workspaces, memberships, sessions,
tenant context, base authorization, audit, configuration, and stable
transaction/error primitives.

Generic commercial or operational capabilities such as billing, credits,
usage, jobs, files, notifications, API keys, and webhooks require an explicit
platform need; they are not automatic Core scope.

### Downstream product repository

A capability belongs downstream when it represents a customer outcome or
contains product workflow, schema, APIs, UI, provider behavior, prompts,
retrieval, evaluation data, product pricing, or usage policy.

Core may expose a narrow public contract consumed by products. Core must never
import a product module, query its tables, or encode its roadmap.

If requested work is product-specific while the current repository is Platform
Core, stop before editing and recommend creating or using the intended
downstream product repository unless the user explicitly changes this
repository's role through an ADR.

## Classify the request

- For explanation or status, inspect and answer without editing.
- For diagnosis, identify cause and evidence; implement only when requested.
- For planning, produce a bounded design and stop unless implementation is also
  requested.
- For implementation, deliver the smallest complete slice and verify it.
- For review, return actionable findings first, ordered by severity.

## Define and implement the slice

State:

- outcome and explicit non-goals;
- Platform Core versus downstream product ownership;
- public application contract and consumers;
- data owner, aggregate, transaction boundary, and schema impact;
- actor, trusted tenant context, permission, entitlement, and resource policy;
- synchronous, streaming, job, webhook, and provider paths;
- idempotency, replay, cancellation, cost, audit, privacy, and retention impact;
- API/UI compatibility, observability, tests, rollout, rollback, and ADR need.

Then:

- keep transports thin and validation at the boundary;
- put orchestration and transactions in application use cases;
- keep domain policies framework-independent;
- define narrow inward-facing ports for real external boundaries;
- wire infrastructure adapters at the composition root;
- import modules only through public contracts;
- reject cross-module table access, internal HTTP, provider types in domain
  code, hidden globals, and speculative generic frameworks;
- promote product code into Core only after proven reuse and ownership review.

## Apply cross-cutting controls

Use the applicable checklists for authentication, authorization, tenant
isolation, audit, secrets, billing, credits, usage, external providers,
generated output, retrieval, automated workflows, queues, files, APIs,
observability, privacy, and operations.

## Product repository creation

When creating a downstream product from Platform Core:

1. start from a reviewed Core commit or tag;
2. rename the package and define a product-specific mission;
3. review runtime identifiers separately: OpenAPI title, cookie name, Compose
   database/user/volume names, environment URLs, test fixtures, HTTP user agents,
   and brand-specific denylist entries;
4. do not silently rename cookies or data volumes because that can invalidate
   sessions or make existing data appear missing;
5. create `src/products/<capability>` until a monorepo migration is approved;
6. add a product architecture supplement and ADRs for providers or changed
   Core decisions;
7. keep product data, providers, prompts, evaluations, pricing, and UI
   downstream;
8. document how compatible Core updates are incorporated and rolled back.

The current registration flow is a default onboarding policy that atomically
creates a user, owner workspace, membership, verification token, session,
audit records, and an encrypted mail-outbox message. Preserve it for
compatibility unless a downstream product explicitly replaces that policy
through a separately designed change.

## Verify in proportion to risk

- Add behavior-focused unit tests for policies and use cases.
- Add integration tests for persistence, transactions, queues, storage, and
  adapters when changed.
- Add API end-to-end tests for changed flows.
- Always test tenant A/B denial for tenant-owned data.
- Always test concurrency, replay, and invariants for billing, credits, and
  webhooks.
- Use deterministic fakes for external providers and keep quality evaluations
  in the owning product repository.
- Run only commands that exist and inspect the final diff after autofix.
- Run `pnpm run check:deprecated` after TypeScript or dependency changes.

## Architecture debt guards

- Do not let one feature import another feature's repository or persistence
  implementation; consume the exported service or an intentional public
  contract.
- Do not give downstream products direct access to `PrismaService` or
  `DatabaseContext`; add an architecture dependency test before product modules
  are introduced.

## Delegate when useful

For complex work, keep integration in the main thread and delegate independent
read-heavy checks to `nexora-architect`, `nexora-security-reviewer`, or
`nexora-quality-reviewer`. Avoid delegation for trivial work and overlapping
parallel edits.

## Report the result

Include outcome, Core versus downstream ownership, affected contracts/data,
schema/security/operations impact, checks and exact results, unresolved choices,
deferred scope, rollback, and ADR follow-up. Never present an unimplemented
component or unrun check as complete.
