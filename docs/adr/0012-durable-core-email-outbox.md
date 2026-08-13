# ADR-0012: Durable encrypted Core email outbox

- Status: Accepted
- Date: 2026-08-11
- Owners: Mail module, with Authentication and Memberships as consumers
- Supersedes: ADR-0007 synchronous best-effort email limitation

## Context

Verification, reset, and membership-invitation records were committed before a
synchronous SMTP attempt. A crash could leave delivery pending forever, and a
failed attempt could not retry because only the bearer-token hash survived.
Persisting plaintext tokens is prohibited. Redis is disposable and cannot own
durable delivery state.

## Decision

- Mail owns `mail_outbox_messages` and a narrow enqueue/delivery contract.
  Authentication and Memberships enqueue an encrypted intent inside the same
  serializable PostgreSQL transaction as their token/invitation and audit fact.
- AES-256-GCM protects the full recipient/subject/body payload with the outbox
  ID as associated data. The raw bearer token exists only in memory, encrypted
  database payload, and the delivered message; it is never stored plaintext.
- Links use URL fragments instead of query parameters so the browser does not
  send the raw token in the initial HTTP request URL.
- The existing SMTP adapter remains behind provider-neutral `OutboundMail`.
  It enforces configured bounded timeouts and production STARTTLS/TLS.
- An in-process poller claims rows with a PostgreSQL compare-and-set lease,
  increments durable attempt count, retries with bounded exponential backoff,
  recovers expired leases, and reaches terminal `SENT` or `FAILED` state.
  Terminal rows erase the encrypted payload.
- Enqueue idempotency and deterministic RFC Message-ID use the source record ID.
  SMTP is at-least-once: provider acceptance followed by process failure may
  duplicate a message, so exactly-once delivery is not claimed.
- Preserve the current response booleans as “sent during this request.” The
  outbox is authoritative for eventual delivery. Existing per-source delivery
  columns remain compatibility projections and are not contracted in this
  development slice.
- The worker stays in the same image/deployable. No Redis queue, external queue,
  service extraction, or product notification framework is introduced.

## Ownership and transaction boundaries

Mail exclusively owns the outbox model/repository, encryption adapter, claim
policy, retry policy, and SMTP handoff. Authentication owns verification/reset
validity; Memberships owns invitation validity. Each originating use case owns
the transaction and calls Mail only through its application contract. Mail
never queries those modules' tables. Every row carries trusted `workspaceId`
and sanitized correlation ID.

## Security, privacy, and tenancy

Outbox rows contain tenant-scoped encrypted PII and bearer links. Normal logs
contain only delivery ID, correlation ID, attempt number, safe event, and error
type. SMTP credentials remain configuration-only. Access to PostgreSQL and the
encryption key must be separated and audited. The one-active-key limitation
requires queue drain/reconciliation before rotation.

## Reliability and observability

PostgreSQL is authoritative. Lease recovery supports process restarts and
concurrent instances; bounded retry prevents unending loops. Expired messages
become terminal without delivery. Metrics count sent/retry/failed outcomes.
Operational alerts must cover queue depth, oldest age, retries, and terminal
failures using operator-approved thresholds.

## Compatibility and schema impact

Adds enums `MailPurpose`, `MailOutboxStatus` and model
`MailOutboxMessage`. No migration is created because the user has not announced
the production transition. Development/test schemas continue through
`prisma db push`. Cookie/session/token hash formats and public route identifiers
are unchanged.

## Verification

Unit tests cover encryption authentication, retry/terminal decisions, and safe
payload parsing. E2E covers transactionally persisted ciphertext, no plaintext
token at rest, successful and degraded delivery, retry state, and health
behavior. The repository claim uses an atomic compare-and-set; the unit suite
covers a rejected competing claim. Container smoke tests cover startup and
shutdown.

## Rollout and rollback

At production transition, introduce the table with an expand migration before
enabling enqueue/worker behavior. Rollback preserves the table and queued rows,
deploys the prior compatible image, and reconciles ambiguous processing rows.
Never drop outbox data during application rollback. The previous image cannot
create retriable intents, so rollback criteria must account for that loss.

## Residual risks and follow-up

- SMTP cannot guarantee exactly-once delivery.
- Online multi-key payload rotation is not implemented.
- Approved retention and cleanup jobs are not implemented.
- Superseded/consumed token cancellation is enforced by token validity at use;
  a stale message may still arrive before expiry. A future bounded slice may add
  transactional cancellation keys without allowing Mail to query owner tables.
