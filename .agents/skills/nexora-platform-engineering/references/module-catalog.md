# Nexora Platform Core Module Catalog

Use this product-neutral target to choose ownership and dependencies. Inspect
the repository before assuming a module or table exists.

## Ownership rules

- Give one module ownership of each business rule and table.
- Expose narrow application contracts; keep repositories and ORM models private.
- Downstream products may consume Core contracts. Core never imports a product
  module or queries its tables.
- Prefer stable IDs, contracts, and committed events over cross-module aggregate
  references.
- Include trusted workspace scope in every tenant-owned repository operation.
- Add a reusable capability to Core only for an unavoidable platform boundary,
  an explicit platform requirement, or a second proven product consumer.

## Foundation modules

### Identity

- Owns stable principals and authentication methods: `identities`,
  `password_credentials`, and future identity links.
- Controls normalized uniqueness, Argon2id, reauthentication, and
  last-login-method protection.

### Authentication

- Owns registration, verification/reset, login/logout, and opaque sessions:
  `sessions`, `email_verifications`, and `password_reset_tokens`.
- Depends on public Identity, Users, Memberships, the Mail `MailOutbox`
  application contract, and Redis cache.
- Controls secure cookies, rotation, revocation, origin checks, throttling,
  timing-safe failures, and hashed tokens.

The implemented registration flow is a compatible default onboarding policy:
it atomically creates identity, user, organization, workspace, OWNER
membership, session, and audit. A downstream product may replace that policy
only through a separately reviewed contract change.

### Users

- Owns `users`, profile, status, and lifecycle.
- Controls self/admin scope, PII minimization, and deactivation effects.

### Organizations

- Owns `organizations` and the commercial ownership boundary.
- Controls ownership transfer, archive constraints, and commercial-operation
  authorization.

### Workspaces

- Owns `workspaces` and the operational tenant boundary.
- Controls trusted tenant context, switching, limits, and archive policy.

### Memberships

- Owns `memberships` and `membership_invitations`.
- Controls hashed invitation tokens, expiry, duplicate prevention,
  cross-tenant denial, and last-owner protection.

### Authorization and roles

- Governs role, permission, and role-permission catalogs.
- Depends on immutable tenant context and Memberships.
- Controls deny-by-default policy, resource ownership, base roles, and tenant
  isolation tests.

### Audit

- Owns `audit_logs` and records stable actor/action/resource facts.
- Controls append-oriented behavior, redaction, retention, correlation, and
  privileged-action coverage.

### Mail

- Owns `mail_outbox_messages` and the provider-neutral `MailOutbox` application
  contract for durable Core email handoff.
- Controls encrypted recipient/subject/body persistence, idempotent enqueue,
  compare-and-set leases and recovery, bounded retry, terminal payload erasure,
  and the SMTP adapter boundary.
- Authentication and Memberships consume this contract; Mail does not query
  their tables or own verification, reset, or invitation validity. This narrow
  email foundation is not a generic jobs or notifications framework.

### Configuration and persistence

- Owns typed startup configuration, transactions, database access, and
  infrastructure lifecycle, but no product data.
- Controls fail-fast validation, secret redaction, explicit transactions, and
  safe health summaries.

## Optional reusable capability packs

These are not automatic Core scope.

- Subscription, billing, and feature access: generic lifecycle and entitlement
  contracts, signed/deduplicated webhooks, replay safety, and reconciliation.
- Credits and usage: integer-micro accounts, append-only transactions,
  reservations, normalized usage, idempotent state transitions, concurrency,
  and reconciliation.
- Generic jobs and cross-capability outbox infrastructure: future durable
  job/attempt state, committed-event delivery, minimal payloads, deduplication,
  bounded retry, cancellation, and audited replay.
- Files: reusable metadata, versions, private tenant storage, signed URLs,
  checksum/MIME validation, quarantine, and cleanup.
- Generic notifications: future reusable delivery state, provider adapters,
  template allow-lists, idempotent send, and unsubscribe handling.
- Feature flags, API keys, and webhooks: deterministic audited flags; show-once
  hashed scoped keys; HMAC webhooks with replay and SSRF defenses.
- External capability gateways: provider-neutral contracts may be promoted only
  after at least two products prove the same stable need. Provider-specific
  behavior and product policy remain downstream.

## Downstream product modules

A product module owns its customer outcome, domain model, use cases, schema,
repositories, APIs, UI, provider adapters, prompts, evaluations, pricing, usage
policy, and product events.

It may consume existing Core contracts but must not query Core-owned tables.
Promoting behavior into Core requires a proven consumer, product-neutral
contract, clear ownership, compatibility/rollback design, and an ADR when
ownership or public contracts change.

## Shared kernel and contracts

- Limit shared primitives to stable identifiers, Money, Clock, Result, domain
  Error, and event envelopes.
- Name contracts by capability, not provider or storage mechanism.
- Keep retryable commands idempotent.
- Include stable IDs, workspace, event version, occurred-at, correlation, and
  causation IDs in integration events.
- Publish only committed facts through an outbox.
- Never expose ORM models, raw provider payloads, secrets, or sensitive content.
