# Nexora Module Catalog

Use this reference to choose ownership and dependencies. The catalog is a target baseline; inspect the repository before assuming a module or table exists.

## Contents

- [Ownership rules](#ownership-rules)
- [Core modules](#core-modules)
- [Product modules](#product-modules)
- [Shared kernel](#shared-kernel)
- [Contract and event guidance](#contract-and-event-guidance)

## Ownership rules

- Give one module ownership of each business rule and table.
- Expose a narrow application contract; keep repositories and ORM models private.
- Let product modules consume Core contracts. Do not let Core import product modules.
- Prefer an ID, stable contract, or outbox event over a cross-module aggregate reference.
- Include workspace scope in every tenant-owned repository operation.
- Add Core behavior only after at least two product modules prove the shared need.

## Core modules

### Identity

- Responsibility: stable principals, password/external identities, linking and unlinking.
- Owns: `identities`, `password_credentials`, `identity_links`.
- Public operations: resolve identity, create password identity, link/unlink external identity.
- Critical controls: normalized email/provider subject uniqueness, Argon2id, re-authentication, conflict and last-login-method protection.

### Authentication

- Responsibility: registration, login/logout, verification/reset, opaque session lifecycle.
- Owns: `sessions`, `verification_tokens`, `password_reset_tokens`.
- Depends on: Identity, Users, Redis session store, email contract.
- Critical controls: Secure HttpOnly SameSite cookie, rotation, revoke-all, CSRF/origin checks, throttling, timing-safe failures.

### Authorization

- Responsibility: permission and resource-policy decisions.
- Owns or governs: roles, permissions, role-permission mapping with Roles and Permissions.
- Depends on: tenant context, memberships, roles.
- Critical controls: deny by default, resource ownership, permission matrix, cross-workspace denial.

### Users

- Responsibility: profile, status, and user lifecycle.
- Owns: `users`.
- Depends on: Identity and Audit.
- Critical controls: self/admin scopes, PII minimization, deactivation effects.

### Organizations

- Responsibility: commercial boundary, billing customer, subscription owner.
- Owns: `organizations`.
- Depends on: Users and Audit.
- Critical controls: owner-only billing changes, ownership transfer, archive constraints.

### Workspaces

- Responsibility: operational tenant and feature-execution boundary.
- Owns: `workspaces`.
- Depends on: Organizations and Memberships.
- Critical controls: mandatory tenant context, workspace limits, archive policy.

### Memberships

- Responsibility: connect users to workspaces with roles and invitations.
- Owns: `memberships`, `membership_invites`.
- Depends on: Users, Workspaces, Notifications.
- Critical controls: hashed invitation tokens, expiry, duplicate prevention, last-owner protection.

### Roles and Permissions

- Responsibility: system RBAC catalog and later workspace custom roles.
- Owns: `roles`, `permissions`, `role_permissions`.
- Depends on: Authorization and Audit.
- Critical controls: immutable system roles, workspace scope for custom roles, owner/admin/member MVP matrix.

### Subscription

- Responsibility: plan state and subscription lifecycle.
- Owns: `plans`, `subscriptions`, `plan_features`.
- Depends on: Billing provider and Feature Access.
- Critical controls: explicit state machine, webhook source of truth, replay and out-of-order handling.

### Billing

- Responsibility: customers, checkout, portal, invoices, payment events.
- Owns: `billing_customers`, `invoices`, `payment_events`.
- Depends on: Stripe adapter, Subscription, Audit.
- Critical controls: raw-body signature verification, event deduplication, reconciliation, no direct trust in redirect state.

### Credits

- Responsibility: accounts, immutable ledger, reserve/commit/release/refund.
- Owns: `credit_accounts`, `credit_transactions`, `credit_reservations`.
- Depends on: Usage and Subscription.
- Critical controls: BigInt micros, row lock or correct optimistic concurrency, idempotency, double-commit prevention, compensating refunds.

### Usage Metering

- Responsibility: normalized usage and provider/customer cost dimensions.
- Owns: `usage_records`.
- Depends on: AI Gateway and Credits.
- Critical controls: append-only, workspace scope, deduplication, pricing/model version, aggregation accuracy.

### Feature Access

- Responsibility: entitlement and plan-limit evaluation.
- Owns: `features`, `plan_features`, `workspace_entitlements`.
- Depends on: Plans, Subscription, Feature Flags.
- Critical controls: server-side source of truth, plan matrix, grace behavior, hard versus soft limit distinction.

### AI Gateway

- Responsibility: provider-neutral generate/stream/embed/moderate, routing, usage normalization.
- Owns: `ai_requests`, `ai_request_attempts`.
- Depends on: Provider Registry, Model Registry, Credits, Usage.
- Critical controls: credential isolation, timeout/cancellation, safe retry, circuit breaker, fallback constraints, stream cancellation, no provider types in domain modules.

### Provider Registry

- Responsibility: providers, capabilities, health, secret references.
- Owns: `ai_providers`, `provider_credentials` or secret references.
- Depends on: Configuration and secret manager.
- Critical controls: no plaintext database key, environment and tenant allow-lists, disabled/health behavior.

### Model Registry

- Responsibility: capabilities, routing metadata, context limits, and versioned pricing.
- Owns: `ai_models`, `model_prices`.
- Depends on: Provider Registry.
- Critical controls: environment allow-list, capability compatibility, pricing version correctness.

### Prompt Registry

- Responsibility: template/version lifecycle, publish, render, and rollback.
- Owns: `prompt_templates`, `prompt_versions`.
- Depends on: Audit, Feature Flags, product-owned evaluation sets.
- Critical controls: immutable versions, typed variables/output, production approval, snapshots, evaluation, injection cases, rollback.

### File Management

- Responsibility: upload intents, metadata, finalization, access, versioning, deletion.
- Owns: `files`, `file_versions`.
- Depends on: object storage, Jobs, Audit.
- Critical controls: size/MIME/checksum validation, tenant ownership, quarantine, malware scanning, short-lived signed URLs, cleanup.

### Job Management

- Responsibility: durable job state and BullMQ bridge.
- Owns: `jobs`, `job_attempts`.
- Depends on: Redis/BullMQ and Audit.
- Critical controls: handler allow-list, minimal payloads, deterministic deduplication, retry classes, cancellation, progress, stalled detection.

### Notifications

- Responsibility: in-app and email notifications.
- Owns: `notifications`, `notification_deliveries`.
- Depends on: email provider and Jobs.
- Critical controls: template allow-list, idempotent send, unsubscribe and provider failure handling.

### Audit Log

- Responsibility: actor/action/resource/before/after records for privileged and sensitive actions.
- Owns: `audit_logs`.
- Consumes: stable contracts/events from all modules.
- Critical controls: append-only, redaction, retention, privileged-action coverage, correlation.

### Configuration

- Responsibility: typed configuration and startup validation.
- Owns: no business tables.
- Depends on: environment and secret manager.
- Critical controls: fail fast per environment, never expose secrets, safe health summary only.

### Feature Flags

- Responsibility: progressive release and kill switches.
- Owns: `feature_flags`, `feature_flag_overrides`.
- Depends on: Tenancy and Configuration.
- Critical controls: server evaluation, audited administration, deterministic default/override/percentage behavior.

### API Keys

- Responsibility: workspace integration keys and scopes.
- Owns: `api_keys`.
- Depends on: Authorization and Audit.
- Critical controls: show once, prefix plus hash, workspace binding, scope, revocation, last-used audit.

### Webhooks

- Responsibility: workspace endpoint registration, subscriptions, delivery, retry, and secret rotation.
- Owns: `webhooks`, `webhook_deliveries`.
- Depends on: Jobs and Audit.
- Critical controls: HMAC, timestamp/replay protection, SSRF and DNS-rebinding defenses, safe retries.

## Product modules

### Translator - MVP

- Outcome: translate text and later files with streaming, projects, history, retry, auto source language, and glossary.
- Owns: `translation_projects`, `translations`, `translation_segments`, `translation_glossary_entries`.
- Use cases: create/stream translation, translate file, get/list history, cancel batch, manage glossary.
- Depends on: AI Gateway, Credits, Usage, Prompt Registry, Files, Feature Access, Audit.
- API: `/v1/translation-projects`, `/v1/translations`, and an SSE stream contract.
- Async jobs: file translation, batch translation, export.
- Invariants: reserve upper bound, commit actual usage, exact workspace scope, no sensitive text logging, idempotent create, cancellation-safe streaming.

### Legal Advisor - post-MVP bounded beta

- Outcome: upload documents, run structured analysis, ask grounded questions, inspect findings/citations, export, delete.
- Owns: `legal_documents`, `legal_analyses`, `legal_findings`, `legal_citations` plus module-owned document/chunk associations.
- Depends on: Files, Jobs, AI Gateway, RAG, Credits, Prompt Registry, Audit.
- Async jobs: scan, extract, embed, analyze, report; each stage is idempotent and checkpointed.
- Invariants: tenant and document-version filters, claim-to-source citation, jurisdiction/consent, disclaimer, injection evaluation, complete vector/object deletion.

### Video Generator - post-MVP bounded beta

- Outcome: create projects, submit async generations, show progress, cancel/retry, and download assets.
- Owns: `video_projects`, `video_generations`, `video_assets`.
- Depends on: Credits, Jobs, Files, Provider Registry, Audit.
- Async jobs: submit, poll, webhook finalize, download, cleanup.
- Invariants: hard budget, capability-aware provider, signed webhook and asset URLs, cancel race handling, reservation expiry, release/refund/commit correctness.

## Shared kernel

Limit shared primitives to stable concepts such as identifier types, Money/credit micros, Clock, Result, domain Error, and event envelope. Keep feature helpers, provider concerns, ORM utilities, and product policies out of the shared kernel.

## Contract and event guidance

- Name contracts by capability, not storage mechanism.
- Keep commands idempotent where redelivery or client retry is possible.
- Include stable IDs, workspace scope, event version, occurred-at time, and correlation/causation IDs in integration events.
- Publish only committed facts through the outbox.
- Do not expose ORM models, raw provider payloads, secrets, or full sensitive content.
