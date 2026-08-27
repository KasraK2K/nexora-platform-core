# Production operations runbook

This runbook defines repository-enforced controls and the decisions an operator
must approve. It does **not** certify a production launch. The database is still
in the development `prisma db push` phase; no production migration history or
managed infrastructure has been selected.

Before launch, copy `ops/production-launch-approval.example.json` outside the
repository, replace every `null`, obtain named approval, and run
`pnpm run check:production` with `PRODUCTION_APPROVAL_FILE` pointing to it. The
approval file may contain operationally sensitive information and must not be
committed.

## Deployment

1. Do not launch until the user explicitly announces the production database
   transition. At that point, add reviewed forward-only migrations using
   expand -> deploy -> backfill -> contract. Never run `prisma db push` against
   production.
2. Review and approve the exact PostgreSQL, Redis, Resend, secret-manager,
   ingress/trusted-proxy, DNS/TLS, logging, metrics, and tracing services and
   regions. Restrict the application port so only the approved ingress can
   reach it.
3. Build `Dockerfile` once from a reviewed commit. Record the resulting image
   digest and vulnerability/SBOM evidence. Promote that exact digest through
   test, staging, and production; never rebuild per environment.
4. Supply configuration externally from `.env.production.example`. Run the
   production gate without printing secret values. The image must start as its
   non-root `node` user.
5. Verify `GET /health/live` and `GET /health/ready`. Route traffic only after
   readiness returns `200`. Resend is asynchronous and intentionally does not
   gate all HTTP traffic; alert on mail metrics and queue state instead.
6. Exercise registration, verification, reset, invitation, login, logout,
   tenant denial, CORS rejection, cookie attributes, security headers, metrics
   authorization, and graceful `SIGTERM` in staging.
7. Roll out backward-compatibly, observe the approved window, and retain the
   previous image digest until rollback criteria expire.

## Rollback

1. Stop new traffic to the affected revision and preserve logs, correlation
   IDs, image digest, configuration version, and database evidence.
2. If stored data remains backward-compatible, redeploy the previous image
   digest. Do not drop the expanded `mail_outbox_messages` table or other
   additive columns during application rollback.
3. Treat `PROCESSING` mail with an expired lease as ambiguous: deterministic
   the Resend idempotency key reduces duplicates within its provider window but
   cannot guarantee exactly-once acceptance indefinitely. Reconcile before replay.
4. If data is not backward-compatible, do not improvise a reverse migration.
   Invoke the reviewed restore/forward-fix procedure and incident owner.
5. Verify readiness, session compatibility, tenant denial, and queued mail
   before restoring traffic. Record the measured rollback duration.

## Backup and restore drill

- PostgreSQL is authoritative for identities, sessions, tenant data, audit,
  token hashes, and the encrypted mail outbox. Select encrypted backups,
  point-in-time recovery, retention, region, access control, and immutability
  that meet approved RPO/RTO. Redis is disposable and is rebuilt from
  PostgreSQL/application activity; do not treat Redis backup as authoritative.
- Back up the mail-outbox encryption key through the approved secret manager.
  Without the matching key, pending encrypted messages cannot be recovered.
- At the approved cadence, restore into a new isolated environment, validate
  integrity and row counts, start the same image with an isolated Resend key,
  exercise
  auth/tenant/readiness paths, and measure recoverable point and elapsed time.
- Never validate a restore by overwriting the live database. Store evidence in
  the location named by `restoreDrillEvidence`; a link is mandatory in the
  launch approval.

## Secret rotation

- Rotate PostgreSQL, Redis, Resend, metrics, and rate-limit secrets through the
  selected secret manager with overlapping credentials where the provider
  supports it. Restart instances gradually and confirm readiness after each.
- `MAIL_OUTBOX_ENCRYPTION_KEY` currently supports one active key. Drain or
  terminally reconcile every pending/retry/processing message before rotating
  it, retain the old key under incident controls until verification completes,
  then restart all instances with the new key. Multi-key online rotation is a
  documented residual limitation.
- Changing `RATE_LIMIT_KEY_SECRET` discards continuity of existing Redis limiter
  keys. Schedule and monitor the change; never log either old or new values.
- Session tokens are opaque random values and only hashes are stored. No cookie
  signing secret exists. Do not rename the session cookie during rotation.

## Incident response

1. Page the approved incident contact and assign commander, operations,
   security/privacy, and communications roles.
2. Preserve structured logs, metrics, traces, audit facts, correlation IDs,
   image/config digests, and dependency state. Do not copy raw passwords,
   tokens, cookies, mail payloads, connection URLs, or provider errors into
   tickets or chat.
3. Contain with the least destructive action: remove traffic, revoke a scoped
   credential, pause at ingress/provider, or deploy the last known image.
4. For suspected token/mail exposure, revoke or supersede affected records and
   sessions. For cross-tenant exposure, involve the privacy owner immediately.
5. Recover through the reviewed rollback or restore path, validate tenant A/B
   denial and readiness, then document timeline, impact, evidence, corrective
   actions, and notification decisions.

## Retention, deletion, and privacy

Operators must approve durations for sessions, verification/reset records,
membership invitations, encrypted mail outbox rows, audit rows, logs, and
traces. No value is implied by the repository. Legal hold, account deletion,
workspace deletion, audit immutability, backup expiry, and data-subject request
procedures also require privacy/legal approval.

Until cleanup jobs are implemented and tested, retention is not automatically
enforced. This is a launch risk, not permission to keep data indefinitely.
Mail payloads are erased after terminal delivery/failure; active encrypted
payloads still contain email addresses and raw bearer links and require strict
database/key access controls.

## Objectives, capacity, quotas, and alerts

The operator approval supplies RPO, RTO, availability and latency SLOs,
requests/second, concurrency, maximum queue depth, Resend quota, and alert
thresholds. Establish load-test evidence and dashboards before approval.

At minimum measure HTTP count/status/latency at ingress, readiness failures,
PostgreSQL/Redis saturation and latency, mail queue depth/oldest age/retries/
terminal failures, process restarts, event-loop/memory/CPU pressure, and Resend
quota/rejection. Repository metrics are vendor-neutral counters at `/metrics`
and require the configured bearer token; hosted retention, alert routing, and
trace export remain operator choices.

## Runtime configuration reference

- Process and networking: `NODE_ENV`, `PORT`, `APP_ORIGINS`, `TRUST_PROXY`.
- Data and secrets: `DATABASE_URL`, `REDIS_URL`, `RATE_LIMIT_KEY_SECRET`.
- Sessions and HTTP: `COOKIE_SECURE`, `COOKIE_SAME_SITE`,
  `SESSION_TTL_SECONDS`, `API_DOCS_ENABLED`.
- Verification: `EMAIL_VERIFICATION_TTL_SECONDS`,
  `EMAIL_VERIFICATION_URL`.
- Reset: `PASSWORD_RESET_TTL_SECONDS`, `PASSWORD_RESET_URL`.
- Invitation: `MEMBERSHIP_INVITATION_TTL_SECONDS`,
  `MEMBERSHIP_INVITATION_URL`.
- Resend: `EMAIL_FROM`, `EMAIL_MESSAGE_ID_DOMAIN`, `RESEND_API_KEY`,
  `RESEND_TIMEOUT_MS`.
- Durable mail: `MAIL_OUTBOX_ENCRYPTION_KEY`, `MAIL_WORKER_ENABLED`,
  `MAIL_MAX_ATTEMPTS`, `MAIL_RETRY_BASE_MS`, `MAIL_RETRY_MAX_MS`,
  `MAIL_POLL_INTERVAL_MS`, `MAIL_CLAIM_TTL_MS`.
- Operations: `DEPENDENCY_HEALTH_TIMEOUT_MS`, `SHUTDOWN_TIMEOUT_MS`,
  `METRICS_ENABLED`, `METRICS_BEARER_TOKEN`.
