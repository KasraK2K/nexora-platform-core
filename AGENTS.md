# Nexora Platform Core Repository Guidance

## Mission and sources of truth

- Build and maintain Nexora Platform Core as a reusable, product-neutral SaaS foundation.
- Treat `docs/architecture/platform-core-baseline.md` as the target implementation baseline, not as proof that a component already exists.
- Downstream repositories own their product modules, product policies, provider integrations, prompts, evaluations, UI, and roadmap.
- Inspect the repository, lockfile, tests, and active configuration before making implementation claims. The repository is currently one NestJS modular monolith; the target pnpm/Turborepo structure has not been implemented.
- Do not silently reorganize the repository or add a product capability. Make either change explicit and reviewable.
- Record a new ADR from `docs/adr/0000-template.md` before intentionally changing an accepted architecture or product-boundary decision.

## Working order

1. Read the relevant baseline sections and inspect the actual code.
2. Decide whether the request belongs to Platform Core or a downstream product repository.
3. Identify the owning module, public contract, tenant boundary, data ownership, and affected invariants.
4. Choose the smallest end-to-end change that satisfies the request.
5. Implement through the correct layers and adapters.
6. Add behavior-focused tests, run the relevant checks, and review the final diff.
7. Report assumptions, schema impact, contract changes, verification, and residual risks.

Use `$nexora-platform-engineering` for architecture-sensitive planning, implementation, or review.

## Current repository commands

- Use pnpm and preserve `pnpm-lock.yaml`.
- Build: `pnpm run build`
- Deprecated API audit: `pnpm run check:deprecated`
- Operations documentation check: `pnpm run check:operations`
- Production-readiness check: `pnpm run check:production`
- Format and rewrite: `pnpm run format`
- Formatting check: `pnpm run format:check`
- Lint and autofix: `pnpm run lint`
- Lint check: `pnpm run lint:check`
- Type check: `pnpm run typecheck`
- Unit tests: `pnpm run test --runInBand`
- Architecture tests: `pnpm run test:architecture`
- End-to-end tests: `pnpm run test:e2e`
- Coverage: `pnpm run test:cov`
- Generate OpenAPI contract: `pnpm run contract:generate`
- Check OpenAPI contract drift: `pnpm run contract:check`
- Documentation check: `pnpm run docs:check`
- Development server: `pnpm run start:dev`

The `lint` and `format` scripts mutate files. Run them before the final diff
review when autofix or formatting is intended; use `lint:check` and
`format:check` for non-mutating verification. Do not claim commands such as
`test:integration`, `openapi:check`, or migration checks exist until they are
added to `package.json` and verified.

The current project uses Jest/ts-jest and enables TypeScript `strict` mode.
`exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` remain deferred by
ADR-0010. Any test-runner migration or stricter follow-up must be an explicit,
verified foundation change.

## Dependency and API compatibility

- Check installed versions, the lockfile, type declarations, and version-matched official documentation before introducing or changing a third-party API.
- Do not add deprecated APIs or configuration, and do not silence deprecation warnings without an approved compatibility reason.
- Run `pnpm run check:deprecated` after TypeScript or dependency changes. Also inspect build, lint, test, install, and runtime output for non-TypeScript deprecations.
- Use `allowBuilds` in `pnpm-workspace.yaml` for dependency lifecycle-script policy. Do not restore the deprecated `pnpm.onlyBuiltDependencies` package field.
- Preserve behavior and add tests when a dependency-facing change can affect validation order, shutdown, persistence, security, timing, or a public contract.

## Development database workflow

- Until the user explicitly states that the platform has moved to production, treat schema work as development-only.
- Change `prisma/schema.prisma` directly and synchronize the development database with the guarded `pnpm run db:push`; use the guarded `pnpm run db:push:test` only for the isolated test database, and regenerate the Prisma client with `pnpm run db:generate` when required.
- Do not create migration directories or run migration-generating commands such as `prisma migrate dev` or `pnpm run db:migrate`.
- Keep development migration history absent. The Prisma schema is the source of truth until the production transition.
- Before synchronization that requires a reset or may lose data, stop and report the impact instead of accepting data loss.
- At the explicit production transition, adopt reviewed forward-only, backward-compatible migrations using expand -> deploy -> backfill -> contract, and update commands and CI at that time.

## Platform boundary

Platform Core may own reusable capabilities such as:

- identity, authentication, users, organizations, workspaces, memberships, authorization, and audit;
- configuration, tenancy context, stable errors, request correlation, and persistence boundaries;
- generic billing, entitlements, usage, credits, jobs, files, notifications, API keys, or webhooks only when explicitly requested and designed for reuse.

Platform Core does not own:

- a named customer product or its workflow, schema, API, UI, prompts, or evaluation data;
- model/provider-specific product behavior, retrieval policies, generated-output policy, or product pricing;
- speculative shared abstractions created for only one downstream product.

A downstream product repository may consume public Core contracts. Core must never import a downstream product module or query its tables. If a capability is useful to only one product, keep it in that product repository. Promote it to Core only after a second proven consumer or an explicit platform requirement.

## Architecture invariants

- Keep one deployable modular monolith until measurable extraction criteria are met.
- Organize capabilities as vertical, feature-first modules.
- A module owns its domain model, use cases, repository ports, persistence implementation, schema changes, presentation adapters, and public contract.
- Import another module only through its public application contract. Never query another module's tables directly.
- Do not add internal HTTP calls between modules in the monolith.
- Keep dependency direction explicit: presentation -> application -> domain; infrastructure implements inward-facing ports and is wired at the composition root.
- Keep domain code independent of NestJS, Prisma, HTTP, Redis, queues, provider SDKs, and framework decorators.
- Let the application use case own transaction boundaries. Publish post-transaction effects through an outbox or equivalent reliable handoff.
- Keep the shared kernel limited to stable primitives such as IDs, Money, Clock, Result, Error, and event envelopes.
- Add an abstraction only for an external boundary, a volatile policy, or a second proven use.

## SOLID and clean-code rules

- Give each class and function one cohesive reason to change.
- Keep controllers and transports thin: validate, resolve context, authorize, map, invoke one use case, and map the response.
- Make dependencies explicit through constructors or function parameters. Do not use service locators or hidden mutable globals.
- Prefer small domain concepts and intention-revealing names over generic `Manager`, `Helper`, or `Util` classes.
- Keep side effects at the edges and business decisions in domain policies or application use cases.
- Depend on narrow capability-oriented ports, not broad persistence or provider facades.
- Prefer composition over inheritance.
- Treat `unknown` as untrusted and narrow it at the boundary. Avoid `any`, non-null assertions, and unchecked casts.
- Remove dead code and local duplication without bundling unrelated cleanup.
- Comment decisions and non-obvious constraints, not a restatement of code.

## Cross-cutting correctness

### Tenancy and authorization

- `Workspace` is the operational tenant boundary; `Organization` is the commercial boundary.
- Every tenant-owned read, write, job, webhook, file operation, cache key, and retrieval query must carry a trusted server-resolved `workspaceId`.
- Never treat a route identifier, UI entitlement, or arbitrary client header as authorization by itself.
- Authorize the action and resource server-side, deny by default, and test tenant A against tenant B.
- RLS may provide defense in depth but never replaces application authorization and repository scoping.

### Identity and secrets

- Use opaque, rotatable server sessions in Secure, HttpOnly, SameSite cookies for the first-party application; changing the authentication model requires an ADR.
- Store hashes or secret references, never plaintext session tokens, API keys, provider credentials, invitation tokens, or reset tokens.
- Never write secrets, sensitive content, raw external-provider payloads, or personally identifiable data to normal logs.

### Billing, credits, and usage

- Add these modules only when the platform or a downstream product has a concrete consumer.
- Store money and credits as integer micros, never floating-point values.
- Keep credit and financial ledgers append-only and auditable.
- Make reserve, commit, release, refund, grants, and webhook processing transactional and idempotent, with concurrency and replay tests.
- Version pricing and record supplier cost separately from customer charge.

### External providers and automated workflows

- Product repositories access external capability providers through narrow provider-neutral ports and adapters.
- Provider SDK types must not leak into domain modules or Platform Core contracts.
- Apply bounded timeout, cancellation, retry, circuit-breaker, allow-list, budget, output-validation, and data-retention policies.
- Keep sensitive request and response content out of normal logs.
- Automated workflows must use typed tools, permissions, budgets, step limits, loop detection, audit records, and human approval for risky actions.

### Jobs and files

- Queue payloads contain identifiers and minimal parameters, not raw secrets or file contents.
- Make handlers idempotent, retry-class aware, cancellable where possible, observable, and safe after redelivery.
- Use deterministic job IDs or database uniqueness for deduplication and persist coarse progress outside Redis.
- Use short-lived presigned URLs; verify size, MIME magic bytes, checksum, ownership, and malware status before marking a file ready.
- Keep object storage private and tenant-scoped; revoke access immediately and clean up asynchronously.

### API and observability

- Use versioned REST/OpenAPI contracts and SSE only when server-to-client streaming is required. New API styles require demonstrated need and an ADR.
- Validate request, response, event, and configuration boundaries. Keep domain objects separate from transport DTOs.
- Use stable error codes and safe messages. Never expose stacks, SQL, secrets, or raw provider errors.
- Propagate request and correlation IDs across APIs, jobs, external attempts, usage, and audit records.
- Emit structured logs, metrics, and traces with redaction.

## Tests and definition of done

- Test behavior and invariants at the lowest valuable layer.
- Add unit coverage for domain policies and application decisions.
- Add integration coverage for repositories, transactions, Redis, queues, storage, and adapters when those surfaces change.
- Add API end-to-end coverage for authentication, authorization, tenancy, validation, stable errors, idempotency, and streaming behavior when applicable.
- Treat tenant isolation, permission matrices, financial invariants, webhook replay, and production migration safety as mandatory coverage for affected capabilities.
- Use deterministic fakes for external providers in ordinary tests and product-owned evaluation fixtures for generated-output quality.
- A change is done only when contract, ownership, tenant/security controls, observability, tests, and operational impact are addressed in proportion to risk.

## Delegation

- Keep the main agent responsible for requirements, decisions, integration, and the final answer.
- For complex read-heavy work, delegate independent checks:
  - `nexora-architect` for module boundaries, data ownership, transactions, roadmap fit, and ADR impact;
  - `nexora-security-reviewer` for authentication, authorization, tenancy, billing, providers, files, webhooks, secrets, and privacy;
  - `nexora-quality-reviewer` for correctness, SOLID/clean-code issues, regressions, tests, and maintainability.
- Do not delegate trivial changes or use overlapping parallel writes.

## Scope discipline

- Follow the requested scope and keep Platform Core product-neutral.
- Do not add a product module, product roadmap, provider integration, prompt, retrieval pipeline, or product UI unless the user explicitly makes that repository a downstream product repository.
- Prefer a working vertical slice over generic scaffolding with no proven consumer.
- If actual code and the baseline disagree, state the discrepancy and preserve working behavior unless the task explicitly authorizes migration or an ADR changes the decision.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
