# ADR-0013: Resend API mail-delivery adapter

- Status: Accepted
- Date: 2026-08-17
- Owners: Mail module
- Supersedes: SMTP-specific delivery portions of ADR-0011 and ADR-0012
- Related issues/changes: Replace Nodemailer and local Mailpit with Resend

## Context

Core already owns a provider-neutral `OutboundMail` port and an encrypted,
durable outbox. Its infrastructure adapter used Nodemailer over SMTP. The
platform now requires Resend's HTTPS API instead, without changing the mail
contract, token flows, persistence model, or module ownership.

## Decision drivers

- Keep provider SDK types and credentials inside Mail infrastructure.
- Preserve durable retries while reducing duplicate provider submissions.
- Bound remote calls and keep provider errors out of normal logs.

## Considered options

### Keep Nodemailer with Resend SMTP

This minimizes code changes but retains SMTP configuration and does not use the
requested Resend API or its SDK idempotency support.

### Use the official Resend Node.js SDK

This replaces SMTP-specific configuration with an API key, supports a bounded
HTTPS request, and maps the durable message identifier to Resend's idempotency
key. It creates direct infrastructure coupling to the selected provider.

## Decision

Mail's provider-neutral `OutboundMail` contract and all consumers remain
unchanged. `ResendOutboundMail` is the sole provider adapter and is wired by
`MailModule`. It sends the already-rendered text body, uses the configured
sender, applies `RESEND_TIMEOUT_MS`, and supplies the durable RFC Message-ID as
the Resend idempotency key. Resend SDK results containing an error reject the
attempt so the existing outbox retry policy remains authoritative.

The API key is required as `RESEND_API_KEY` and remains external secret
configuration. Production rejects the committed local placeholder and the
shared `resend.dev` test sender; production must use a verified sender domain.

## Consequences

### Positive

- SMTP and Nodemailer-specific runtime configuration is removed.
- Resend can deduplicate repeated submissions within its idempotency window.
- No schema, HTTP contract, or cross-module dependency changes are introduced.

### Negative and tradeoffs

- Local mail delivery now requires network access and a Resend credential.
- Resend is a concrete Core infrastructure dependency and rollback requires
  restoring the former adapter and SMTP configuration.
- Provider idempotency is time-bounded, so delivery remains at-least-once.

## Compatibility and migration

The outbox schema, encrypted payload format, message identifiers, application
contract, and HTTP APIs are unchanged. Deployment configuration must replace
all `SMTP_*` values with `RESEND_API_KEY` and `RESEND_TIMEOUT_MS`. No Prisma
schema synchronization or migration is required.

## Security, privacy, and tenancy

The Resend key must live in the deployment secret manager and must never be
committed or logged. Resend receives the recipient address and rendered email
content, including time-limited bearer links. Existing encrypted persistence,
workspace scope, redacted logs, and terminal payload erasure remain unchanged.

## Reliability and observability

Each API request has a bounded abort signal. Provider errors become failed
attempts without logging raw response content. PostgreSQL leases, retry bounds,
metrics, and terminal states remain authoritative. Resend idempotency reduces,
but does not eliminate, ambiguous acceptance after its provider window.

## Verification

Unit tests verify request mapping, provider idempotency, timeout signal
presence, and error propagation. Existing Mail, configuration, architecture,
build, and documentation gates cover unchanged contracts and boundaries.

## Rollout and rollback

Rotate the exposed credential before deployment. Configure the replacement key
and a verified sender domain, deploy, and smoke-test one controlled recipient.
Monitor retry and terminal-failure metrics. Rollback restores the prior image
and its SMTP settings; preserve and reconcile queued or processing outbox rows.

## Follow-up work

- [ ] Approve the production Resend domain, quota, region, and retention terms.
- [ ] Add webhook-backed delivery-state reconciliation only if product or
      operational requirements need status beyond provider acceptance.
