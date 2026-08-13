# ADR-0011: Production runtime and operations baseline

- Status: Accepted
- Date: 2026-08-11
- Owners: Platform Core
- Related: ADR-0002, ADR-0005, ADR-0010

## Context

Platform Core had secure session primitives and local PostgreSQL/Redis Compose
services, but no production image, explicit CORS policy, stable probes,
dependency readiness, vendor-neutral metrics surface, or operational gate.
The deployment baseline requires these without selecting a hosted provider or
changing the accepted modular-monolith topology.

## Decision

- Keep one NestJS/Express deployable and preserve existing routes, opaque
  session format, cookie names, database/volume identifiers, and tenant model.
- Require explicit `NODE_ENV`. Production startup fails when cookie, exact
  HTTPS origins, trusted proxy mode/list, TLS database/Redis/SMTP settings,
  documentation exposure, metrics credentials, or mail-outbox secrets are
  unsafe or invalid.
- Configure credentialed CORS from the exact trusted-origin set. Keep exact
  Origin validation on state-changing authentication routes as the server-side
  authorization control.
- Emit standard security headers. Authentication responses remain `no-store`.
- Expose public `GET /health/live` without dependency I/O and
  `GET /health/ready` with bounded PostgreSQL and Redis checks. SMTP does not
  gate HTTP readiness because delivery is durable and asynchronous.
- Propagate sanitized request, correlation, and W3C trace-parent identifiers;
  emit structured redacted logs and low-cardinality OpenMetrics counters.
  `/metrics` is disabled by default and returns not-found unless an approved
  bearer token is configured.
- Build one digest-pinned multi-stage Node image, run as the non-root `node`
  user, accept configuration only at runtime, use liveness for container
  health, and handle normal Nest shutdown hooks.
- Keep hosted infrastructure, region, ingress, secret manager, telemetry
  destination, RPO/RTO/SLO/capacity/quotas/alerts/retention as named operator
  approvals. `check:production` rejects a missing/incomplete approval artifact.

## Alternatives considered

- Kubernetes/sidecars/service extraction: rejected; no measured need and it
  would change topology.
- Hosted observability SDK: rejected until a provider and tenancy model are
  approved. Vendor-neutral correlation and metrics hooks preserve that choice.
- Make SMTP a readiness dependency: rejected because it would take unrelated
  authenticated traffic offline while durable mail can recover independently.

## Consequences

Production configuration is stricter than local/test configuration. Swagger is
unavailable in production. Redis degradation removes the instance from
readiness because security rate limits depend on Redis. The repository still
cannot claim launch readiness until the production database transition,
infrastructure selections, restore drill, security testing, and approval
artifact exist.

## Contracts and data

Adds `/health/live`, `/health/ready`, and optional authenticated `/metrics`.
There is no session or tenant schema change in this ADR. Responses reveal only
stable `up`/`down` dependency states and never URLs, SQL, errors, or secrets.

## Security, privacy, and tenancy

Trusted proxy entries are validated IP/CIDR or known private aliases; `/0` is
rejected. Production requires HTTPS origins, Secure/HttpOnly configured
SameSite cookies, certificate-verifying PostgreSQL TLS, `rediss`, and SMTP TLS.
Operations approval carries no customer secrets and must not be committed.

## Reliability and observability

Readiness is bounded by `DEPENDENCY_HEALTH_TIMEOUT_MS`, becomes false before
shutdown, and records low-cardinality dependency outcomes. Logs redact
credential-shaped keys and URL userinfo. Correlation IDs flow through the
request context and durable mail boundary.

## Verification

Configuration negative tests, probe unit/E2E tests, CORS/header/cookie tests,
metrics authorization tests, image build/UID/health inspection, graceful stop,
and operations-document parity are required gates.

## Rollout and rollback

Promote the same image digest through environments. Route traffic only on
readiness. Roll back to the previous digest only while stored data remains
compatible; preserve additive schema and follow the production runbook. This
ADR does not authorize production `db push` or migration generation.

## Open operator decisions

Ingress/proxy addresses, providers/regions/sizing/HA, secret manager, telemetry
destination, SMTP sender/auth/quota, RPO/RTO/SLO/capacity/alerts, retention,
incident contacts, restore evidence, and production migration transition.
