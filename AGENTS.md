# Nexora AI Repository Guidance

## Mission and sources of truth

- Build Nexora as the AI SaaS platform defined by `docs/architecture/ai-saas-platform-baseline.md`.
- Treat that document as the target implementation baseline, not as proof that a component already exists.
- Inspect the repository, lockfile, and active configuration before making implementation claims. This repository is currently a single NestJS starter, while the target is a pnpm/Turborepo modular monorepo.
- Do not silently reorganize the starter into the target monorepo. Make foundation work an explicit, reviewable change.
- Record a new ADR from `docs/adr/0000-template.md` before intentionally changing an accepted architecture decision.

## Working order

1. Read the relevant baseline sections and inspect the actual code.
2. Identify the owning module, public contract, tenant boundary, data ownership, and affected invariants.
3. Choose the smallest end-to-end change that satisfies the request.
4. Implement through the correct layers and adapters.
5. Add behavior-focused tests, run the relevant checks, and review the final diff.
6. Report assumptions, migrations, contract changes, verification, and residual risks.

Use `$nexora-platform-engineering` for architecture-sensitive planning, implementation, or review.

## Current repository commands

- Use pnpm and preserve `pnpm-lock.yaml`.
- Build: `pnpm run build`
- Lint and autofix: `pnpm run lint`
- Unit tests: `pnpm run test -- --runInBand`
- End-to-end tests: `pnpm run test:e2e`
- Coverage: `pnpm run test:cov`
- Development server: `pnpm run start:dev`

The lint script mutates files. Run it before the final diff review. Do not claim target commands such as `typecheck`, `test:integration`, `openapi:check`, or database checks exist until they are added to `package.json` and verified.

The current project uses Jest/ts-jest and does not enable full TypeScript strictness. Vitest and strict TypeScript are target baseline decisions, but migrating to them must be explicit and verified rather than assumed.

## Architecture invariants

- Keep one deployable modular monolith until measurable extraction criteria are met.
- Organize product capabilities as vertical, feature-first modules.
- A capability module owns its domain model, use cases, repository ports, persistence implementation, migrations, presentation adapters, and public contract.
- Import another module only through its public application contract. Never query another module's tables directly.
- Product modules may depend on Core contracts. Core must never depend on Translator, Legal Advisor, Video Generator, or another product module.
- Do not add internal HTTP calls between modules in the monolith.
- Keep the dependency direction explicit: presentation -> application -> domain; infrastructure implements inward-facing ports and is wired at the composition root.
- Keep domain code independent of NestJS, Prisma, HTTP, Redis, BullMQ, provider SDKs, and framework decorators.
- Let the application use case own transaction boundaries. Publish post-transaction effects through an outbox or an equivalent reliable handoff.
- Keep the shared kernel very small: stable primitives such as IDs, Money, Clock, Result, Error, and event envelopes. Do not turn it into a generic utility bucket.
- Add an abstraction only for an external boundary, a volatile policy, or a second proven use. Avoid speculative interfaces and generic frameworks.

## SOLID and clean-code rules

- Give each class and function one cohesive reason to change.
- Keep controllers and transports thin: validate, resolve context, authorize, map, invoke one use case, and map the response.
- Make dependencies explicit through constructors or function parameters. Do not use service locators or hidden mutable globals.
- Prefer small domain concepts and intention-revealing names over generic `Manager`, `Helper`, or `Util` classes.
- Keep side effects at the edges and business decisions in domain policies or application use cases.
- Depend on narrow capability-oriented ports, not broad persistence or provider facades.
- Prefer composition over inheritance.
- Treat `unknown` as untrusted and narrow it at the boundary. Avoid `any`, non-null assertions, and unchecked casts.
- Remove dead code and duplication that is local to the change, but do not bundle unrelated cleanup.
- Comment decisions and non-obvious constraints, not a restatement of the code.

## Cross-cutting correctness

### Tenancy and authorization

- `Workspace` is the operational tenant boundary; `Organization` is the commercial and subscription boundary.
- Every tenant-owned read, write, job, webhook, file operation, cache key, and retrieval query must carry a trusted `workspaceId` from server-side context.
- Never trust a random identifier, route parameter, UI entitlement, or client-provided workspace header as authorization by itself.
- Authorize the action and the resource server-side, deny by default, and test tenant A versus tenant B.
- RLS may provide defense in depth, but it never replaces application authorization and repository scoping.

### Identity and secrets

- Use opaque, rotatable server sessions in Secure, HttpOnly, SameSite cookies for the first-party application; do not replace them with JWTs without an ADR.
- Store hashes or secret references, never plaintext API keys, session tokens, provider credentials, invitation tokens, or reset tokens.
- Never write secrets, raw provider payloads, file contents, prompts, or personally identifiable data to normal logs.

### Billing, credits, and usage

- Store money and credits as integer micros, never floating-point values.
- Keep the credit ledger append-only and auditable.
- For costly operations, reserve before execution, record normalized actual usage, then commit the actual charge or release/refund safely.
- Make reserve, commit, release, refund, grants, and webhook processing transactional and idempotent. Cover concurrency and replay with tests.
- Version pricing and record provider cost separately from the customer charge.

### AI, prompts, RAG, and agents

- Access model providers only through the unified AI Gateway and provider adapters. Provider SDK types must not leak into domain modules.
- Route by capability, allow-list, cost, latency, quality, and health; apply bounded timeout, cancellation, retry, and circuit-breaker policies.
- Version prompts as immutable records with typed variables and output schemas. Production publishing requires evaluation evidence and a rollback target.
- Keep prompt and file content out of logs by default. Apply redaction, retention, and provider data-policy controls.
- Scope every retrieval by `workspaceId` and document version. Preserve source spans for citations and reject ungrounded legal claims.
- Prefer deterministic workflows. Permit model-directed agents only for bounded, evaluated use cases with typed tools, permissions, budgets, step limits, loop detection, audit logs, and human approval for risky actions.

### Jobs and files

- Queue payloads contain identifiers and minimal parameters, not raw secrets, prompts, or files.
- Make handlers idempotent, retry-class aware, cancellable where possible, observable, and safe after redelivery.
- Use deterministic job IDs or database uniqueness for deduplication and persist coarse progress outside Redis.
- Upload directly through short-lived presigned URLs, then verify size, MIME magic bytes, checksum, ownership, and malware status before marking a file ready.
- Keep object storage private and tenant-scoped; delete access immediately and clean up objects asynchronously.

### API and observability

- Use versioned REST/OpenAPI contracts and SSE for server-to-client streaming. Do not add GraphQL or WebSockets without a demonstrated need and an ADR.
- Validate request, response, event, and configuration boundaries. Keep domain objects separate from transport DTOs.
- Use stable error codes and safe messages. Never expose stack traces, SQL, secrets, or raw provider responses.
- Propagate request/correlation IDs through browser, API, job, provider attempt, usage, and audit records.
- Emit structured logs, metrics, and traces with redaction. Observability is part of the feature, not a later cleanup task.

## Tests and definition of done

- Test behavior and invariants at the lowest valuable layer; do not mirror implementation details in tests.
- Add unit coverage for domain policies and application decisions.
- Add integration coverage for repositories, transactions, migrations, Redis/queues, storage, and provider adapters when those surfaces change.
- Add API end-to-end coverage for authentication, authorization, tenancy, validation, error mapping, idempotency, and streaming behavior.
- Treat tenant isolation, permission matrices, financial invariants, webhook replay, and migration safety as mandatory tests, not optional coverage.
- Use deterministic fake AI adapters for ordinary tests. Include timeout, cancellation, malformed output, fallback, usage normalization, and stream failure cases.
- Add evaluation fixtures and publish gates when a prompt, model policy, RAG behavior, or AI-visible output changes.
- A change is done only when its contract, data ownership, security, observability, tests, and operational impact are addressed in proportion to risk.

## Delegation

- Keep the main agent responsible for requirements, decisions, integration, and the final answer.
- For complex read-heavy work, delegate independent checks in parallel:
  - `nexora-architect` for module boundaries, data ownership, transactions, roadmap fit, and ADR impact.
  - `nexora-security-reviewer` for authentication, authorization, tenant isolation, files, SSRF, prompt injection, data leakage, billing abuse, and secrets.
  - `nexora-quality-reviewer` for correctness, SOLID/clean-code issues, regressions, tests, and maintainability.
- Use the built-in `explorer` for broad repository discovery and `worker` for a bounded implementation task.
- Do not delegate trivial changes. Avoid parallel writes unless file ownership is disjoint and the main agent has a clear integration plan.

## Scope discipline

- Follow the user's requested scope. Do not implement later roadmap phases while delivering the current vertical slice.
- The MVP product is Translator. Legal Advisor, RAG, full Video Generator, general agents, custom roles, SSO/MFA/OAuth, BYOK, Kubernetes, multi-region, and dedicated tenants remain outside MVP unless explicitly requested.
- Prefer a working vertical slice over platform scaffolding with no user value.
- If actual code and the baseline disagree, state the discrepancy. Preserve working behavior unless the task explicitly authorizes migration or an ADR changes the decision.
