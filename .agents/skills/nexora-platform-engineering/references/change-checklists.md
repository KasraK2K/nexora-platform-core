# Nexora Platform Engineering Change Checklists

Apply only relevant sections. An unchecked applicable item requires work or an
explicitly justified exception.

## Current-state and boundary gate

- Inspect owning files, scripts, lockfile, tests, schema, and configuration.
- Verify changed third-party APIs against installed declarations and official
  version-matched documentation.
- Separate implemented behavior from the target baseline.
- Classify the request and decide Platform Core versus downstream product
  ownership.
- Identify scope and non-goals; avoid speculative shared infrastructure.

## Change design and layering

- Name the owning module, public contract, and consumers.
- State aggregate, transaction, data ownership, and schema impact.
- State actor, trusted workspace, permission, entitlement, and resource policy.
- State sync, stream, job, webhook, provider, idempotency, replay,
  cancellation, compatibility, rollout, rollback, and ADR behavior.
- Keep transport mapping at the edge, orchestration in application use cases,
  invariants in domain code, and adapters in infrastructure.
- Reject cross-module table access, internal HTTP, hidden globals, generic
  managers/repositories, speculative interfaces, and product policy in Core.

## Data, authentication, and tenancy

- Assign one owner to every table and business rule.
- Put workspace scope on tenant-owned rows, unique constraints, and leading
  indexes.
- Keep transactions at the use-case level and outbox facts in the same commit.
- During development use `prisma db push`; create migration history only after
  the explicit production transition.
- Resolve actor and workspace server-side; never trust arbitrary client tenant
  identifiers.
- Authorize action and resource, deny by default, and test tenant A/B.
- Protect last-owner, role, invitation, session, verification, reset, and
  revocation flows as applicable.
- Hash tokens and keys; store credentials as secret references; audit sensitive
  actions without PII or secrets.

## Commercial and metered capabilities

- Confirm a concrete consumer before adding the capability to Core.
- Verify signed webhooks and handle deduplication, replay, and out-of-order
  events.
- Store money and credits as integer micros with append-only ledgers.
- Make reserve, commit, release, refund, and grants transactional and
  idempotent.
- Prevent double transitions, stale reservations, insufficient balance, and
  races.
- Version plans, entitlements, supplier cost, and customer charge.
- Add concurrency and reconciliation tests.

## External providers and automated output

- Keep integration downstream unless a shared contract is proven.
- Use provider-neutral inward-facing ports; isolate SDK types, credentials, and
  raw errors in adapters.
- Enforce tenant/environment allow-lists, timeout, cancellation, retry,
  fallback, rate, total budget, and output validation.
- Never switch a visible stream after its first emitted data.
- Record safe usage, cost, latency, provider, attempt, and fallback metadata.
- Keep sensitive request/response content out of logs.
- Keep instructions and evaluation data versioned and product-owned.
- For retrieval or tools, enforce tenant filters, source spans, typed schemas,
  permissions, budgets, loop detection, audit, and human approval for risk.

## Jobs, files, API, and operations

- Use minimal queue payloads, deterministic job IDs, idempotent handlers,
  bounded retry, durable progress, cancellation, failed state, and audited
  replay.
- Use private tenant storage and short-lived signed URLs; validate existence,
  size, checksum, MIME, ownership, malware status, and cleanup replay.
- Use versioned REST/OpenAPI, separate transport/domain models, stable errors,
  idempotent costly creates, cursor pagination, and sanitized correlation IDs.
- Use SSE heartbeat, final metadata, cancellation, and safe stream errors only
  when streaming is required.
- Emit structured logs, metrics, and traces with redaction; define retention,
  deletion, dashboards, backup/restore, and rollback.

## Tests and completion

- Unit-test policies and application decisions.
- Integration-test repositories, transactions, adapters, queues, and storage.
- End-to-end-test changed APIs with real auth and tenant context.
- Contract-test transport schemas, adapters, events, and webhooks.
- Add tenant isolation, concurrency, replay, timeout, cancellation, malformed
  output, and failure coverage where applicable.
- Use deterministic provider fakes and keep quality evaluation downstream.
- Run only verified repository commands and `pnpm run check:deprecated` after
  TypeScript or dependency changes.
- Confirm one owner, inward dependencies, no downstream product behavior in
  Core, safe failures, rollback compatibility, behavior-focused tests, and the
  smallest useful scope.
- Report outcome, contracts/data, checks, assumptions, deferred scope, and ADR
  follow-up.

## ADR triggers

Create or update an ADR for a product-boundary change, promotion into Core,
ownership transfer, public contract change, database/tenant/authentication
topology, provider/storage/queue/API category, service extraction, security or
privacy boundary, or deliberate architecture exception.
