# Nexora AI SaaS Platform - Implementation Baseline

## Document control

- Status: Implementation baseline
- Baseline version: 0.1
- Source: `ai-saas-platform-architecture-fa_260717_215610.pdf`
- Source date: 2026-07-17
- Language: English distillation of the Persian source document
- Intended audience: software architects, technical leads, full-stack engineers, and coding agents

This is the actionable architecture target for the repository. It is not a statement that every described component is already implemented. The repository started as a single NestJS 11 application. Always inspect the code and `package.json` before assuming a target component, dependency, command, or directory exists.

The baseline is a decision framework, not an immutable contract. Record a new ADR for a material deviation, including context, alternatives, consequences, migration, verification, and rollback.

## Contents

- [Product vision and boundaries](#product-vision-and-boundaries---pdf-pages-5-8)
- [Architecture style](#architecture-style---pdf-pages-8-17)
- [System and execution flows](#system-and-execution-flows---pdf-pages-9-15)
- [Module map](#module-map---pdf-pages-18-34)
- [AI platform](#ai-platform---pdf-pages-35-41)
- [Data and persistence](#data-and-persistence---pdf-pages-42-50)
- [Jobs, storage, API, and errors](#jobs-storage-api-and-errors---pdf-pages-51-57)
- [Observability and security](#observability-and-security---pdf-pages-58-60)
- [Quality strategy](#quality-strategy---pdf-pages-61-64-and-85)
- [Frontend and user experience](#frontend-and-user-experience---pdf-pages-65-67)
- [Configuration, delivery, and operations](#configuration-delivery-and-operations---pdf-pages-68-76)
- [Roadmap and MVP](#roadmap-and-mvp---pdf-pages-77-79)
- [Accepted architecture decisions](#accepted-architecture-decisions---pdf-pages-80-83-and-87-88)
- [Open implementation decisions](#open-implementation-decisions)
- [Architecture risks](#architecture-risks---pdf-page-86)

## Product vision and boundaries - PDF pages 5-8

Nexora is a multi-tenant AI SaaS platform that gives a customer one account, one panel, and multiple gradually enabled AI capabilities. Shared platform capabilities live in Core; paid product capabilities live in domain modules inside one backend.

Target users include small teams, consultants, content creators, and operational units that need several AI tools. A customer has an Organization and one or more Workspaces:

- Organization: commercial boundary, billing customer, subscription owner.
- Workspace: operational tenant boundary for data, authorization, usage, and feature execution.
- MVP onboarding creates one Organization and one Workspace while preserving the multi-workspace model.

Packaging combines a base plan, feature entitlements, usage credits, and later optional add-ons. Revenue may include monthly or annual subscriptions, additional credits, enterprise plans, and later BYOK or dedicated deployment.

### Goals

- Deliver Translator as the first payable vertical slice in 12 weeks.
- Add later modules with minimal change to Core and navigation.
- Make usage, provider cost, selling price, credit balance, and ledger activity auditable.
- Enforce tenant isolation, permissions, and audit trails.
- Allow models and providers to change without rewriting domain logic.
- Support repeatable local, staging, and production deployments.

### Non-goals

- Training or serving a general-purpose foundation model.
- Microservices, Kubernetes, a service mesh, or event streaming from day one.
- A general-purpose workflow engine or AI framework.
- Supporting every provider, use case, and billing method at once.
- A general autonomous agent. Only bounded, evaluated agent use cases are allowed.
- Premature Core abstractions for needs not proven by real products.

## Architecture style - PDF pages 8-17

Use a modular monolith: one deployable system with independently owned modules and explicit boundaries.

### Dependency and ownership rules

- Each capability module owns its entities, policies, use cases, repository ports, persistence implementation, migrations, APIs, and tests.
- External consumers import only a module's public application contract.
- Product/domain modules depend on Core contracts; Core has no knowledge of product modules.
- Modules do not query each other's tables directly.
- Modules do not call each other through localhost HTTP inside the monolith.
- Logical database ownership is separate even while all modules share one PostgreSQL schema and migration review process.
- Use stable IDs, public contracts, outbox events, and idempotent consumers so a module can be extracted later.
- Abstract after a second real need, except where an external boundary or volatile policy already requires a port.

### Layering inside a module

```text
feature/
|- presentation/       # controllers, guards, transport mappers
|- application/        # use cases, commands, queries, ports
|- domain/             # entities, value objects, policies, domain errors
|- infrastructure/     # Prisma repositories, Redis, queues, provider bridges
`- feature.module.ts   # composition root
```

- Presentation handles validation, authentication context, authorization invocation, mapping, status codes, and transport behavior.
- Application coordinates use cases and owns transaction boundaries.
- Domain contains business rules and is independent of NestJS, Prisma, HTTP, Redis, BullMQ, and provider SDKs.
- Infrastructure implements ports defined inward and contains integrations and outbox consumers.

### Target monorepo

```text
ai-platform/
|- apps/
|  |- api/                 # NestJS HTTP + SSE
|  |- worker/              # BullMQ workers and schedulers
|  `- web/                 # Next.js App Router
|- packages/
|  |- backend/             # Core and domain modules
|  |- contracts/           # Zod API and event contracts
|  |- database/            # Prisma schema, client, migrations
|  |- config/              # typed configuration
|  |- observability/       # logger, metrics, tracing
|  |- ai-sdk/              # gateway contracts and provider adapters
|  |- testkit/             # factories, containers, mocks
|  `- ui/                  # design-system primitives
|- infra/
|  |- docker/
|  |- caddy/
|  `- scripts/
|- docs/adr/
|- turbo.json
|- pnpm-workspace.yaml
`- package.json
```

Use pnpm workspaces and Turborepo. Do not introduce Nx unless later scale demonstrates a need that Turborepo cannot meet.

## System and execution flows - PDF pages 9-15

### Containers

```text
Browser/mobile -> Next.js web -> REST/OpenAPI + SSE -> NestJS API
                                                -> BullMQ worker
NestJS API/worker -> PostgreSQL, Redis, private object storage
AI Gateway -> OpenAI first, then compatible provider adapters
Platform -> Stripe, email provider, observability services
```

The API and worker use the same packages but separate bootstraps. The API handles short requests and streaming; the worker handles long-running, scheduled, and retryable operations.

### HTTP request

```text
HTTP request -> correlation ID -> session and tenant resolver
-> permission/resource policy -> application use case
-> repository/Core contract -> response or safe error mapper
```

### Background job

```text
API command -> database transaction + outbox -> queue publisher
-> BullMQ -> worker -> idempotent handler -> progress/result/event
```

### AI request

```text
Domain use case -> credit reservation -> AI Gateway -> policy/router
-> provider adapter -> normalize usage -> commit or release credits
-> stream or result
```

### Authentication

```text
Login -> credential verification -> opaque session -> Secure HttpOnly cookie
-> session resolution -> rotation/revocation
```

### Files

```text
Create upload intent -> presigned upload -> finalize and validate
-> scan -> extract/OCR -> normalize -> chunk -> embed -> index -> ready
```

## Module map - PDF pages 18-34

Core capabilities:

- Identity, Authentication, Authorization, Users
- Organizations, Workspaces, Memberships, Roles and Permissions
- Subscription, Billing, Credits, Usage Metering, Feature Access
- AI Gateway, Provider Registry, Model Registry, Prompt Registry
- Files, Jobs, Notifications, Audit Log
- Configuration, Feature Flags, API Keys, Webhooks

Product modules:

- Translator: MVP vertical slice for text translation and streaming, projects, history, glossary, file/batch translation, credits, usage, billing, and UI.
- Legal Advisor: later bounded RAG workflow for document ingestion, analysis, grounded questions, findings, citations, reports, and deletion.
- Video Generator: later asynchronous provider-backed generation with progress, cancellation, storage, webhook/poll reconciliation, and credit correctness.

When adding a product, create its permission, feature catalog entry, entitlement, public contract, module-owned schema and repositories, use cases, API/OpenAPI, UI route, tenant-isolation tests, provider fake, observability, and usage/pricing policy. Do not change Core unless at least two modules prove the shared need.

See `.agents/skills/nexora-platform-engineering/references/module-catalog.md` for detailed ownership and controls.

## AI platform - PDF pages 35-41

### Unified AI Gateway

The domain sends provider-neutral intent containing:

- workspace, capability, messages, model policy, optional output schema/tools
- timeout, idempotency key, feature/operation metadata, correlation ID

The gateway selects candidates by capability and tenant/environment allow-list, then cost, latency, quality, and health. Adapters isolate provider SDKs and normalize:

- output and finish reason
- tokens and cached tokens
- provider, model, provider request ID
- provider cost in integer micros
- typed errors such as authentication, rate limit, timeout, filtering, invalid output, and unavailability

Rules:

- Reserve maximum estimated customer credits before the call.
- Retry only transient, safe operations with jitter and a total deadline.
- Propagate cancellation and enforce timeouts.
- Use provider/model circuit breakers and health metrics.
- Permit fallback only between semantically equivalent, policy-compatible models.
- Do not switch a stream after the first user-visible delta.
- Validate structured output after every attempt.
- Keep real credentials in a secret manager; the database stores references only.
- Log metadata, cost, latency, and fallback reason, but not raw prompts by default.

### Prompt registry

- Prompts belong to product modules; lifecycle infrastructure belongs to Core.
- Store immutable, checksummed versions with typed variables and optional output schemas.
- Keep separate active pointers for test, staging, and production.
- Require render snapshots, golden datasets, structured-output validation, injection cases, and regression reports before production publication.
- Roll back by atomically changing the active pointer; do not delete prior versions.
- Constrain tenant customization to approved variables and never permit overriding the safety system block.

### RAG and documents

Use PostgreSQL with pgvector for the initial moderate workload. Every chunk stores `workspaceId`, document version, stable chunk ID, content, metadata, embedding model/version, and source span.

- Validate size, extension, MIME magic bytes, and checksum.
- Quarantine until malware scanning succeeds.
- OCR only when the text layer is absent or low quality.
- Use heading/semantic-aware chunks with bounded overlap.
- Require tenant and metadata filters before top-k retrieval; rerank only afterward when needed.
- Persist citations to chunk/page/offset and reject claims that cannot be grounded where grounding is required.
- Tombstone access immediately and asynchronously remove objects, chunks, and embeddings.

### Workflows and agents

- Prefer deterministic stateful workflows.
- Register typed tools with input schemas, permissions, risk levels, timeouts, and cost estimates.
- Build execution context from actor, workspace, correlation ID, approved scopes, and budget.
- Enforce token, credit, wall-clock, and step budgets plus loop/no-progress detection.
- Audit every tool call and summarized result.
- Require human approval for sending, paying, deleting, or sensitive advice.
- Never grant an agent arbitrary HTTP, filesystem, or database access.

## Data and persistence - PDF pages 42-50

Use PostgreSQL as the source of truth and Prisma as the TypeScript data mapper. Use raw parameterized SQL only for capabilities Prisma cannot express safely, such as selected locks, bulk work, or vector queries, and cover it with integration tests.

### Database rules

- Generate UUIDv7 IDs in the application and store UUIDs.
- Store business timestamps as UTC `timestamptz`.
- Put non-null `workspace_id` and workspace-leading indexes on tenant-owned rows.
- Include tenant columns in unique constraints.
- Use explicit foreign keys inside a module; review stable aggregate references across modules.
- Use JSONB for flexible metadata, not as a replacement for queryable columns.
- Base indexes on observed access paths; common candidates include `(workspace_id, created_at desc)`, status, and idempotency keys.
- Keep use-case transactions explicit. Update ledger state and outbox rows in the same transaction.
- Use optimistic versioning for concurrent project, prompt, and subscription state.
- Apply expand -> deploy -> backfill -> contract migrations. Production migrations are forward-only, and rollback depends on backward-compatible schemas.
- Seed permissions, plans, feature catalog, and models idempotently per environment.
- Use real PostgreSQL/Testcontainers for integration and migration tests, not SQLite substitutes.

### Multi-tenancy

Use a shared database and shared schema initially. Resolve the actor from a session or API key, validate workspace membership, and inject an immutable tenant context. Repository public methods for tenant-owned data must not be callable without a workspace scope.

Test cross-tenant denial for reads, writes, jobs, files, exports, webhooks, and retrieval. Optional PostgreSQL RLS is defense in depth, not the primary authorization system.

### Billing, subscriptions, credits, and usage

Stripe is the initial billing provider through a provider interface. Verified, deduplicated webhooks are the source of truth; internal subscription and entitlement state is a materialized view.

- Store credits as `BigInt` micros.
- Keep an immutable transaction ledger and an account balance protected by row locking or correct optimistic concurrency.
- Make idempotency scope include workspace/actor and operation.
- Reserve before expensive work; commit actual usage; release on failure/cancel; refund with a compensating transaction.
- Never delete or rewrite ledger history.
- Version plans, entitlements, pricing, provider cost, and selling price.
- Use grants/buckets rather than overwriting balances for resets and promotions.
- Handle webhook replay and out-of-order delivery.
- Move payment failure through grace and restriction; never immediately delete customer data.

## Jobs, storage, API, and errors - PDF pages 51-57

### Jobs

Initial BullMQ queues include document processing, video generation, notifications, evaluations, and cleanup. Classify retryable errors, use exponential backoff with jitter, persist a failed/dead-letter state, and require safe administrative replay.

Use deterministic job IDs or database uniqueness, explicit priority, queue/provider concurrency limits, cancellation state plus `AbortSignal`, step and wall-clock timeouts, heartbeats, resumable checkpoints, and queue depth/age/failure metrics. Queue payloads contain IDs and minimal parameters only.

### Object storage

Use an S3-compatible contract with MinIO locally and Cloudflare R2 in production. PostgreSQL owns metadata and lifecycle state.

- Keys are environment/workspace/file/version scoped.
- Upload and download URLs are short-lived and signed.
- Buckets are private; logs must not contain full signed query strings.
- Finalization verifies the object before scanning.
- Delete marks access unavailable immediately and schedules object cleanup.

### API

- Version REST routes under `/v1` and publish an OpenAPI contract.
- Use SSE for AI streaming and job progress; provide polling fallback where appropriate.
- Define Zod contracts separate from domain objects.
- Use `{ data, meta }` responses, cursor pagination for scalable lists, and allow-listed filters/sorts.
- Require idempotency keys for costly creates, billing, and webhooks.
- Propagate a sanitized request ID.
- Rate-limit by IP for authentication and by actor/workspace/provider for feature usage.
- Sign outbound webhooks with an HMAC, timestamp window, and delivery ID.

Errors have stable domain codes, safe messages, optional safe details, request ID, and retryability. Map them at the transport edge. Never return internal causes, provider bodies, SQL, secrets, or stack traces.

## Observability and security - PDF pages 58-60

Use Pino JSON logs, OpenTelemetry traces/metrics, Grafana Cloud/Loki/Prometheus/Tempo as appropriate, and Sentry for exceptions and frontend errors.

Correlate browser, request, job, provider attempt, usage, ledger, and audit activity. Monitor request latency/errors, AI TTFT and total latency, tokens, provider cost, fallback, database pool/query latency, queue depth/age/failures, and product metrics. Redact PII and disable prompt/file logging by default.

Threat controls must cover:

- credential stuffing, session fixation, CSRF, XSS, and authorization bypass
- cross-tenant database, file, cache, and RAG leakage
- injection in SQL, prompts, tools, webhooks, and URLs
- SSRF and DNS rebinding for webhook/URL tools
- file malware and MIME spoofing
- provider data exfiltration and credential leakage
- credit abuse, billing replay, and webhook forgery
- dependency, image, and build supply-chain risks
- backup confidentiality and controlled restore access

Apply TLS/HSTS, secure host cookies, origin checks, CSP and related security headers, non-root containers, minimal capabilities, lockfile enforcement, dependency/image/secret scanning, and audited secret rotation.

## Quality strategy - PDF pages 61-64 and 85

Target layers:

- Unit: domain policies, pricing, routing, validation.
- Integration: PostgreSQL, Prisma repositories, Redis, BullMQ, MinIO, transactions, migrations.
- API E2E: real Nest application with authentication and tenant context.
- Web E2E: registration, workspace, translation, history, and Stripe sandbox purchase.
- Contract: Zod, OpenAPI diffs, provider adapters, signed webhook fixtures.
- Security: tenant A/B matrices, common web/API threats, dependencies, and images.
- Load: login, translation stream, history, and job status.
- AI evaluation: deterministic fakes for plumbing plus golden datasets for quality.

Coverage percentage is secondary. Tenant, permission, financial, and ledger branches require near-complete meaningful coverage, including mutation/edge cases.

AI evaluation compares prompt/model candidates against a versioned baseline using structured validity, task rubrics, hallucination/grounding checks, citation accuracy, latency, cost, fixed-version LLM judging, and human samples. Cost or quality regression blocks publication.

The definition of done for any artifact includes ownership, contract, tenant/auth controls, data and migration impact, errors, observability, tests, and operational rollback in proportion to risk.

## Frontend and user experience - PDF pages 65-67

Target Next.js App Router with React, Tailwind CSS, and shadcn/ui. Prefer Server Components for stable shell/data and Client Components only for interaction, forms, streaming, and client query state.

- Use typed/Zod-validated same-origin API clients.
- Use TanStack Query for client server-state only and React Hook Form + Zod for forms.
- Handle loading, error, empty, entitlement, retry, and cancellation states.
- Stream incrementally and provide polling fallback for long jobs.
- Upload directly to object storage and finalize through the API.
- Treat the server as the source of truth for entitlements.
- Build responsive navigation and use CSS logical properties for RTL/i18n.
- Keep a shared feature registry for route, permission, entitlement, flag, and navigation metadata.

The single panel contains workspace switching, credits, jobs, notifications, feature catalog, recent activity, files, billing/settings, and a protected admin area.

## Configuration, delivery, and operations - PDF pages 68-76

- Validate typed configuration at startup and fail fast.
- Keep `APP_ENV` separate from `NODE_ENV` so staging uses production build behavior.
- Use deterministic fake AI and isolated dependencies for tests, sandbox services for staging, and managed secrets/data services with strict TLS in production.
- Local Docker Compose targets PostgreSQL/pgvector, Redis, MinIO, Mailpit, API, worker, and web.
- Run migrations as an explicit job/command, not implicitly during API startup.
- Provide live and ready health endpoints.

CI installs from the frozen lockfile, lints, type-checks, tests, checks API and migrations, builds packages/images, scans dependencies/secrets/images, deploys staging, migrates, and runs smoke tests. Promote the same immutable image to production behind approval.

Initial production topology is a hardened VPS running Caddy plus stateless web/API/worker containers, with managed PostgreSQL and Redis and private R2 storage. Use TLS, security headers, health gates, expand-first migrations, backward-compatible rollback, and tested backup/restore runbooks.

Performance priorities include bounded caching, connection pool budgets, async work, SSE cancellation/backpressure, cursor pagination, workspace-leading indexes, direct multipart uploads, provider timeouts/circuit breakers, Redis rate limits, stateless APIs, queue-specific worker scaling, and model/cost tiering.

### Extract a microservice only when measured

Consider extraction for independently dominant compute cost, repeated failure-isolation impact, a different runtime/GPU need, materially different release cadence, independent team ownership, mandatory security boundary, or specialized heavy-processing nodes.

Before extraction, stabilize the public contract, remove external direct table access, add outbox events and idempotent consumers, run the new service in shadow mode, define data ownership/migration, shift traffic behind a flag, compare metrics, remove the old path, and add an ADR, SLO, runbook, and owner.

Likely first candidates are document processing, video workers, and the AI Gateway only after real scale or isolation evidence.

## Roadmap and MVP - PDF pages 77-79

1. Foundation: pnpm/Turbo repository, lint/typecheck/test/build, Docker, Prisma, migrations/seeds, CI.
2. Core MVP: identity/authentication, users, organization/workspace/membership, RBAC, tenant tests, AI Gateway, credits, usage, audit.
3. Translator: sync/stream translation, projects/history, UI, plans, Stripe, entitlements, end-to-end payable flow.
4. Platform reuse: files, queues, prompt registry, notifications, analytics.
5. Legal Advisor: ingestion, pgvector RAG, citations, asynchronous bounded analysis.
6. Video Generator: provider adapter, async generation, progress, storage, cancellation/retry/webhook and credit correctness.

MVP includes first-party authentication, one-owner organization/workspace membership, base RBAC, plans/subscriptions/credits, Stripe checkout/portal, text Translator with streaming and history, OpenAI-first gateway/model registry, reserve/commit/release, limited admin, observability, CI/CD, Docker deployment, backup, and rollback.

MVP excludes production Anthropic/Gemini routing, complex files, RAG/Legal, full video, general agents/workflow designer, custom roles, SSO/MFA/OAuth, advanced BYOK, complex tax/overage/reseller billing, native mobile, Kubernetes, multi-region, active-active, and dedicated tenants.

Success means a user can pay, translate, see accurate usage and credits, and support can trace a request end to end.

## Accepted architecture decisions - PDF pages 80-83 and 87-88

- ADR-001: TypeScript strict on Node.js 24 LTS.
- ADR-002: NestJS 11 with the Express adapter.
- ADR-003: PostgreSQL.
- ADR-004: Prisma ORM 7 in infrastructure, with reviewed raw SQL for advanced cases.
- ADR-005: managed Redis with `noeviction` for sessions, queues, and rate limits.
- ADR-006: BullMQ.
- ADR-007: modular monolith.
- ADR-008: shared database/shared schema.
- ADR-009: `workspace_id` row isolation.
- ADR-010: REST/OpenAPI plus SSE.
- ADR-011: Next.js 16.2 App Router and React.
- ADR-012: MinIO locally and Cloudflare R2 in production behind S3 APIs.
- ADR-013: immutable credit ledger plus reservation/commit.
- ADR-014: unified AI Gateway and provider adapters, OpenAI first.
- ADR-015: pnpm workspaces and Turborepo.
- ADR-016: opaque server session cookie plus Redis.
- ADR-017: pgvector.
- ADR-018: VPS + Docker Compose with managed data services for MVP.

Additional target choices include Zod validation, Vitest, Testcontainers, Supertest, Playwright, k6, Pino JSON, OpenTelemetry, Grafana Cloud, Sentry, GitHub Actions, Stripe Billing/Checkout/Portal, Caddy, and Vazirmatn for Persian UI.

Version numbers are the accepted baseline snapshot, not permission to upgrade blindly. Verify the lockfile, compatibility, migration guide, and current official documentation before installing or making a major upgrade. Use an ADR for a changed major-version or technology decision.

## Open implementation decisions

The PDF intentionally leaves the following choices open. Do not invent or silently hard-code them; resolve them with product, security, operations, or an ADR when the relevant phase begins:

- exact plan prices, credit conversion, provider margins, included limits, grant/expiry rules, grace periods, cancellation/refund behavior, and free-trial policy
- managed PostgreSQL/Redis/VPS providers, region and sizing, secret manager, email provider, malware scanner, OCR/parser stack, and production observability tenancy
- whether and when to enable PostgreSQL RLS as defense in depth
- audit, document, prompt-debug, and legal-document retention periods
- data classification, provider DPA/allow-list policy, supported legal jurisdictions, disclaimer wording, evaluation thresholds, and human-review sampling
- production Anthropic/Gemini routing, BYOK, enterprise identity, custom roles, and dedicated-tenant behavior
- tenant resolver precedence between route/header selection and the session's active workspace
- production cookie, origin, and CORS design if the web and API use different hosts
- concrete RPO/RTO, capacity budgets, queue concurrency, provider quotas, and revised SLOs after traffic exists
- whether multi-workspace UX is exposed in MVP or only supported by the schema

## Architecture risks - PDF page 86

Continuously guard against overengineering, a platform without a shipped product, provider lock-in, uncontrolled AI cost, hallucination, provider outage, prompt injection, cross-tenant leakage, billing/credit errors, slow validation, parallel feature sprawl, premature microservices, and weak demand.

Mitigate through the Translator-first roadmap, no abstraction without proven use, gateway contracts, budgets and credit reservation, evaluation and citations, timeouts/fallback, tenant matrices, immutable ledgers, webhook reconciliation, a single active product roadmap, and measurable extraction criteria.
