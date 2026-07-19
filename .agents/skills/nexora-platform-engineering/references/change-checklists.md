# Nexora Change Checklists

Apply only the sections relevant to the change. Treat each unchecked item as either required work or an explicit, justified non-applicable item.

## Contents

- [Current-state gate](#current-state-gate)
- [Change design](#change-design)
- [Layering and SOLID](#layering-and-solid)
- [Data and migration](#data-and-migration)
- [Authentication, authorization, and tenancy](#authentication-authorization-and-tenancy)
- [Billing, subscription, credits, and usage](#billing-subscription-credits-and-usage)
- [AI Gateway and prompts](#ai-gateway-and-prompts)
- [RAG and product agents](#rag-and-product-agents)
- [Background jobs and outbox](#background-jobs-and-outbox)
- [Files and storage](#files-and-storage)
- [API and frontend](#api-and-frontend)
- [Observability, privacy, and operations](#observability-privacy-and-operations)
- [Tests and evaluation](#tests-and-evaluation)
- [Architecture review](#architecture-review)
- [ADR triggers](#adr-triggers)
- [Completion report](#completion-report)

## Current-state gate

- Inspect the real owning files, package scripts, lockfile, tests, and runtime configuration.
- Separate implemented behavior from the target baseline.
- Confirm whether the requested work is explanation, diagnosis, planning, implementation, or review.
- Identify user-visible scope and explicit non-goals.
- Avoid unrelated foundation migrations or later roadmap work.

## Change design

- Name the owning Core or product module.
- State the public application contract and all consumers.
- State the aggregate and transaction boundary.
- State module-owned data and any cross-module stable IDs.
- State actor, trusted workspace source, permission, entitlement, and resource policy.
- State synchronous, streaming, job, webhook, and provider paths.
- State idempotency scope and duplicate/replay behavior.
- State compatibility, rollout, rollback, and ADR need.
- Choose the smallest vertical slice that produces user value.

## Layering and SOLID

- Keep transport validation/mapping in presentation.
- Put orchestration and transaction ownership in one application use case.
- Put invariants and policies in framework-independent domain code.
- Define a narrow port for each real external boundary.
- Implement ports in infrastructure and wire them at composition root.
- Import another module only through its public contract.
- Reject direct table access across modules and internal HTTP in the monolith.
- Give each type one cohesive reason to change.
- Prefer composition, explicit dependencies, and intention-revealing names.
- Avoid service locators, hidden globals, generic managers, generic repositories, and speculative interfaces.

## Data and migration

- Assign one module owner to every table and migration.
- Put non-null workspace scope on every tenant-owned row.
- Include workspace scope in unique constraints and leading indexes.
- Use UTC `timestamptz` and application-generated UUIDv7 where the baseline applies.
- Keep JSONB for flexible metadata rather than searchable core fields.
- Base indexes on actual access paths and include idempotency/status needs.
- Keep transaction boundaries at the use-case level.
- Write outbox events in the same transaction as the state change.
- Use expand -> deploy -> backfill -> contract for production changes.
- Preserve compatibility with the previous application image during rollback.
- Add real PostgreSQL migration/integration coverage when persistence exists.

## Authentication, authorization, and tenancy

- Resolve the actor from a verified session or API key.
- Validate requested workspace membership server-side.
- Inject immutable tenant context; do not pass arbitrary client workspace IDs as trusted context.
- Authorize action plus resource ownership and deny by default.
- Scope repositories, cache keys, files, jobs, webhooks, audit, and retrieval.
- Add tenant A/B positive and negative tests at repository and endpoint boundaries.
- Protect last-owner, role downgrade, invitation, session rotation, and revocation flows where relevant.
- Hash tokens and API keys; store provider credentials as secret references.
- Add audit records for privileged and sensitive actions.

## Billing, subscription, credits, and usage

- Verify signed billing webhooks from raw input and deduplicate provider events.
- Handle replay and out-of-order transitions.
- Store money and credits as integer micros.
- Keep an append-only ledger and auditable balance derivation.
- Reserve atomically before expensive work.
- Commit normalized actual usage or release/refund through an idempotent transition.
- Prevent insufficient balance, double commit, double release, stale reservation, and race conditions.
- Version plan, entitlement, model price, provider cost, margin, and customer charge.
- Add concurrency, reconciliation, and invariant-zero-mismatch tests.

## AI Gateway and prompts

- Use a provider-neutral capability request.
- Keep provider SDK types and raw errors inside adapters.
- Enforce environment/tenant/model allow-lists.
- Bound timeout, cancellation, retry, fallback, circuit breaker, rate, and total budget.
- Validate structured output after each attempt.
- Never fallback a stream after the first visible delta.
- Record tokens, cost, latency, provider/model, attempt, and fallback metadata.
- Keep raw prompts/content out of standard logs.
- Use immutable prompt versions with typed variables/output and checksums.
- Add render snapshots, injection cases, golden evaluation, cost/latency comparison, publish gate, and rollback pointer.

## RAG and product agents

- Validate and quarantine documents before processing.
- Preserve document version, stable chunk IDs, page/offset source spans, and embedding model/version.
- Apply workspace and document filters before similarity search.
- Require grounded citations for claims that promise grounding.
- Separate instructions from retrieved data and validate generated output.
- Tombstone access immediately and remove objects/vectors asynchronously.
- Give tools typed schemas, required permissions, risk, timeout, and cost.
- Enforce actor/workspace/scopes plus token, step, credit, and wall-clock budgets.
- Detect repeated tool calls/no progress and audit every tool result.
- Require human approval for payment, deletion, sending, or sensitive advice.
- Give product agents no arbitrary database, HTTP, or filesystem access.

## Background jobs and outbox

- Put identifiers and minimal parameters in the queue payload; exclude secrets, prompts, and files.
- Use deterministic job IDs or a database uniqueness guard.
- Make the handler idempotent after redelivery.
- Classify retryable versus permanent errors and use bounded backoff with jitter.
- Persist job/attempt state and coarse progress outside Redis.
- Support cancellation, timeout, heartbeat, and resumable checkpoints when the provider permits.
- Use a failed/dead-letter state and safe, audited administrative replay.
- Emit queue depth, age, active, failure, retry, and stalled metrics.

## Files and storage

- Check plan/quota before creating an upload intent.
- Use short-lived presigned upload/download URLs and private buckets.
- Verify object existence, size, checksum, MIME magic bytes, extension, and ownership on finalize.
- Quarantine until malware scanning succeeds.
- Avoid full signed URLs and sensitive filenames in logs.
- Make deletion revoke access immediately and enqueue idempotent cleanup.
- Test expired URLs, MIME spoofing, cross-tenant access, duplicate finalize, and cleanup replay.

## API and frontend

- Use versioned resource-oriented REST and document it in OpenAPI.
- Keep Zod transport contracts separate from domain models.
- Use stable response and error envelopes.
- Require idempotency for costly creates, billing, and webhook operations.
- Use cursor pagination and allow-listed filtering/sorting.
- Propagate sanitized request/correlation IDs.
- Apply actor/workspace/provider-aware rate limits.
- Use SSE heartbeat, final usage, cancellation, and safe stream error behavior.
- Treat server authorization and entitlements as authoritative.
- Cover loading, error, empty, retry, cancellation, responsive, RTL/i18n, and accessibility states.

## Observability, privacy, and operations

- Correlate browser, request, use case, job, provider attempt, usage, ledger, and audit.
- Emit structured logs with stable event names and safe error codes.
- Add latency/error, queue, database, provider, cost, usage, and business metrics.
- Add traces at external and transaction boundaries.
- Redact secrets, PII, prompts, provider payloads, and file contents by default.
- Define retention and data-deletion behavior.
- Add actionable dashboards/alerts and avoid high-cardinality identifiers in metrics.
- Update health, deployment, migration, backup/restore, and rollback runbooks when affected.

## Tests and evaluation

- Unit-test domain policies and application decisions.
- Integration-test repositories, transactions, migrations, adapters, queues, and storage.
- End-to-end-test changed API/user flows with real auth and tenant context.
- Contract-test OpenAPI/Zod, provider adapters, events, and webhook signatures.
- Add tenant isolation matrices for every tenant-owned repository/endpoint.
- Add concurrency/replay tests for financial and asynchronous state.
- Use deterministic AI fakes for plumbing and sanitized fixtures for edge cases.
- Add golden datasets and human samples for output-quality changes.
- Test timeout, cancellation, malformed output, fallback, and stream failures.
- Run only verified current repository commands and record exact results.

## Architecture review

- Confirm one clear owner for behavior and data.
- Confirm all dependencies point inward and cross-module use is contractual.
- Confirm no target technology is described as already implemented.
- Confirm tenancy, authorization, financial, and AI cost invariants.
- Confirm failures are safe, idempotent, observable, and recoverable.
- Confirm migration and rollback are compatible.
- Confirm tests prove behavior rather than implementation structure.
- Confirm the change is the smallest useful slice and does not create premature platform scope.

## ADR triggers

Create or update an ADR for:

- a changed accepted technology or major-version baseline
- a new cross-module dependency or ownership transfer
- a public contract or compatibility strategy change
- a database/tenant topology or authentication model change
- a new external provider category or storage/queue/API style
- a service extraction or new deployable runtime
- a security, privacy, retention, or compliance boundary decision
- a deliberate exception to an architecture invariant

## Completion report

- Summarize the delivered user outcome.
- List affected modules, contracts, data, and migrations.
- List security, tenant, credit/usage, AI, and operational controls addressed.
- List commands and tests actually run with results.
- List assumptions, unresolved choices, deferred scope, and rollback/ADR follow-up.
