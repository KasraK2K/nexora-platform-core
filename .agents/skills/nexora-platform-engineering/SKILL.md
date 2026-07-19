---
name: nexora-platform-engineering
description: Plan, design, implement, diagnose, or review Nexora AI SaaS changes against the repository's modular-monolith architecture. Use for NestJS modules, vertical slices, APIs, persistence, tenancy, authentication or authorization, billing or credits, AI Gateway providers, prompts, RAG, workflows or agents, queues, files, frontend integration, deployment, ADRs, or architecture-sensitive refactors. Do not use for trivial copy edits or questions unrelated to this repository.
---

# Nexora Platform Engineering

Use the PDF-derived implementation baseline without confusing planned architecture with implemented code.

## Load the right context

1. Read the applicable `AGENTS.md`.
2. Inspect the actual repository, `package.json`, lockfile, tests, and configuration before making claims.
3. Read only the relevant sections of [the architecture baseline](../../../docs/architecture/ai-saas-platform-baseline.md).
4. Read [module-catalog.md](references/module-catalog.md) when choosing ownership, contracts, dependencies, tables, jobs, permissions, or product boundaries.
5. Read [change-checklists.md](references/change-checklists.md) when planning, implementing, or reviewing a change.
6. Use [the ADR template](../../../docs/adr/0000-template.md) when a material decision changes or extends the baseline.

## Preserve current truth

- Treat the target monorepo, Prisma, Redis, BullMQ, Next.js, Zod, OpenAPI, Stripe, storage, RAG, and observability stack as planned until the repository contains and configures them.
- Use current verified scripts and test tooling. Do not invent commands or claim planned gates passed.
- Make foundation migrations explicit. Do not mix a repo-wide scaffold migration into an unrelated feature.
- Keep existing behavior unless the request authorizes a change.

## Classify the request

- For an explanation or status question, inspect and answer without editing.
- For diagnosis, identify the cause and evidence; implement only when requested.
- For planning, produce a bounded design and stop before implementation unless the user asks for both.
- For implementation, deliver the smallest complete vertical slice and verify it.
- For review, report findings first, ordered by severity, with concrete file references and missing tests.

## Engineer the change

### 1. Define the slice

State:

- user-visible outcome and explicit non-goals
- owning Core or product module
- public application contract and consumers
- data owner, aggregate/transaction boundary, and migration impact
- actor, trusted tenant context, permission, entitlement, and resource policy
- synchronous, streaming, asynchronous, and external-provider paths
- usage, cost, credit, audit, privacy, and retention impact
- API/UI behavior and compatibility
- observability, test, rollout, rollback, and ADR needs

Do not start with generic shared infrastructure. Start from the user outcome and the module that owns it.

### 2. Respect the dependency direction

- Keep presentation thin.
- Put orchestration and transaction boundaries in application use cases.
- Put business invariants in framework-independent domain code.
- Define narrow ports inward and implement them in infrastructure.
- Wire implementations at the composition root.
- Import other modules only through public contracts.
- Reject direct cross-module table access, provider types in domain code, hidden global dependencies, and internal HTTP inside the monolith.
- Extract shared concepts only after a second proven consumer, except for unavoidable external boundaries.

### 3. Apply cross-cutting controls

Use the applicable checklists for:

- authentication, authorization, tenant isolation, audit, and secrets
- billing, subscriptions, credit ledger, usage, concurrency, and idempotency
- AI routing, prompt versions, output validation, evaluation, and data policy
- RAG grounding, source spans, prompt injection, and deletion
- queues, outbox, retries, cancellation, progress, and redelivery
- file validation, quarantine, signed URLs, ownership, and cleanup
- API contracts, stable errors, pagination, rate limits, SSE, and compatibility
- structured logs, traces, metrics, alerts, privacy, and runbooks

### 4. Implement pragmatically

- Prefer cohesive, intention-revealing code and explicit dependencies.
- Add no interface merely to satisfy a pattern; add it for a real boundary or substitution need.
- Avoid generic repositories, generic managers, service locators, and speculative frameworks.
- Validate untrusted data at the edge and keep transport/ORM objects out of the domain.
- Make illegal states difficult to represent where the complexity pays for itself.
- Keep the change narrow and preserve intentional repository conventions.

### 5. Verify in proportion to risk

- Add behavior-focused unit tests for policies and use cases.
- Add integration tests for persistence, transactions, queues, storage, migrations, and adapters.
- Add API end-to-end tests for the changed route or flow.
- Always add tenant A/B denial tests for tenant-owned data.
- Always add replay/concurrency/invariant tests for billing, credits, and webhooks.
- Use deterministic AI fakes for normal tests and evaluation fixtures for AI quality changes.
- Run only commands that exist in the repository, then inspect the final diff after any autofix command.

## Delegate when useful

For a complex change, keep integration in the main thread and delegate independent read-heavy work:

- use `nexora-architect` for ownership, dependency, data, transaction, roadmap, and ADR analysis
- use `nexora-security-reviewer` for threat and tenant-isolation analysis
- use `nexora-quality-reviewer` for correctness, SOLID/clean-code, regression, and test analysis

Avoid subagents for trivial tasks and avoid overlapping parallel edits.

## Report the result

Include:

1. outcome and changed behavior
2. important architecture choices and assumptions
3. affected contracts, data, migrations, security, and operations
4. checks run and their results
5. remaining risks, deferred scope, and ADR follow-up

Never present an unimplemented target component or an unrun check as complete.
