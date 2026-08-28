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

The implemented business model has five concepts: User, Workspace,
Membership, Invitation, and Session. Email verification, password reset,
audit, and durable mail are supporting security and operations records rather
than extra account concepts.

### Users

- Owns `users`, including normalized email, Argon2id password state, profile,
  verification status, and optimistic password replacement.
- Exposes a focused `UsersService`; its concrete repository remains private.

### Workspaces

- Owns `workspaces`, the operational tenant boundary, and permanent
  `ownerUserId`.
- Controls creation and owner-authorized rename. Public OWNER/MEMBER labels are
  derived rather than persisted.

### Memberships and invitations

- Owns `memberships` and `membership_invitations`.
- Controls active access, soft removal/reactivation, hashed invitation tokens,
  expiry, duplicate prevention, owner protection, and cross-workspace denial.
- Every invitation grants MEMBER access to exactly one workspace.

### Sessions

- Owns PostgreSQL-authoritative opaque `sessions` scoped to one user and one
  active `workspaceId`.
- Exposes a narrow `SessionsService` for creation, lookup, rotation support,
  and revocation. Only token hashes persist; there is no Redis session cache.

### Authentication

- Owns HTTP workflows for registration, verification, password reset/change,
  login/logout, current-session context, and workspace selection/switching.
- Owns `email_verifications` and `password_reset_tokens`; it consumes public
  Users, Workspaces, Memberships, Sessions, Audit, and Mail services.
- Controls secure cookies, token rotation, origin checks, distributed Redis
  throttling, timing-safe failures, and hashed single-use tokens.

The default registration policy atomically creates User, Workspace, owner
Membership, verification token, Session, Audit records, and encrypted
MailOutboxMessage. A downstream product may replace it only through a
separately reviewed contract change.

### Authorization

- Owns the dependency-free permission policy and the one global
  deny-by-default route-admission guard.
- Resolves actor and workspace from trusted session context and derives OWNER
  or MEMBER from workspace ownership; there is no stored role catalog.

### Audit

- Owns `audit_logs` and records stable actor/action/resource facts.
- Controls append-oriented behavior, redaction, retention, correlation, and
  privileged-action coverage.

### Mail

- Owns `mail_outbox_messages` and the provider-neutral `MailService`
  application contract for durable Core email handoff.
- Controls encrypted recipient/subject/body persistence, idempotent enqueue,
  compare-and-set leases and recovery, bounded retry, terminal payload erasure,
  and the Resend adapter boundary.
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
