# ADR-0001: Screen new passwords against breached-password data

- Status: Accepted
- Date: 2026-08-07
- Owners: Nexora engineering
- Supersedes: None
- Related issues/changes: Registration hardening

## Context

Registration previously compared passwords with five hard-coded strings. That
list was too small to provide meaningful protection against commonly used or
previously breached passwords. Nexora needs stronger screening without a paid
service, without sending plaintext passwords outside the application, and
without making account creation depend entirely on a remote provider.

Core Authentication owns password establishment and therefore owns this
decision. No database, tenant boundary, or public API contract changes.

## Decision drivers

- Block commonly used and breached passwords before Argon2id hashing.
- Use no paid API, API key, or new runtime package.
- Never transmit or log a plaintext password or complete password digest.
- Keep registration available during remote-service failures.
- Keep the blocklist reproducible and inexpensive to update.

## Considered options

### A. Keep a manually maintained in-code list

This is fast and independent, but it becomes stale immediately and provides
little meaningful coverage.

### B. Query Pwned Passwords and fail registration when it is unavailable

This gives current breach coverage, but an external outage would prevent all
new registrations.

### C. Query Pwned Passwords with a bundled local fallback

This gives current coverage in the normal path while retaining deterministic
local protection and registration availability during an outage.

## Decision

Choose option C.

Authentication exposes a narrow `PasswordCompromiseChecker` application port.
Its infrastructure adapter first compares the complete NFC-normalized password
against a bundled local SHA-256 hash set. The set is generated from the
MIT-licensed SecLists copy of the NCSC top-100k password list, filtered to
passwords that can pass Nexora's 15-to-128-character policy, and supplemented
with exact Nexora-specific expected passwords.

If the local check does not match and remote checking is enabled, the adapter
uses the free Pwned Passwords range API. It computes SHA-1 locally, sends only
the first five hexadecimal characters over HTTPS, requests response padding,
and compares the remaining hash locally. SHA-1 is used only for this range
protocol; Argon2id remains the password-storage algorithm.

The endpoint is fixed in code. Requests have a configurable bounded timeout,
do not retry, reject redirects, and enforce a bounded, strictly parsed response.
If the remote lookup is disabled, unavailable, non-successful, malformed, or
oversized, the adapter falls back to the local result. Unexpected checker
failures outside that boundary make registration temporarily unavailable.

## Consequences

### Positive

- Current breach coverage without a paid subscription or API key.
- No plaintext password or complete lookup hash leaves Nexora.
- No new npm dependency or database migration.
- Registration remains available during remote outages.
- The local dataset is reproducible and versioned.

### Negative and tradeoffs

- A password absent from the local fallback may be accepted during a remote
  outage even if it exists in the complete Pwned Passwords corpus.
- Registration gains one bounded external request in the normal path.
- The bundled dataset needs periodic manual regeneration and review.

## Compatibility and migration

The registration request and response contracts are unchanged. Existing
password hashes and accounts are unchanged. The stricter rule applies only
when establishing a new password. No schema synchronization is required.

## Security, privacy, and tenancy

Passwords are normalized before both local and remote comparison. Comparison
uses the entire password, not substrings. Logs contain only stable operational
event names and failure categories; passwords, complete hashes, prefixes, and
provider response bodies are excluded. The check is global and contains no
tenant-owned data.

## Reliability and observability

The remote request uses a bounded timeout, response-size limit, strict parsing,
padding, no redirect, and no retry. A safe warning records only the failure
category. Operators can disable remote lookup with configuration while keeping
the local blocklist active.

## Verification

- Unit tests for local matches, remote matches, disabled lookup, failure
  fallback, malformed data, and oversized data.
- Registration-use-case tests proving rejection occurs before hashing and
  persistence.
- API end-to-end coverage for a locally blocked password.
- Build, lint, deprecation audit, and existing authentication tests.

## Rollout and rollback

Enable remote lookup by default and monitor lookup-failure warnings and signup
latency. Set `PWNED_PASSWORDS_ENABLED=false` for an immediate local-only
rollback. Removing the checker binding restores the previous behavior without
data migration.

## Follow-up work

- [ ] Establish a quarterly blocklist refresh and source-review owner.
- [ ] Reuse the same checker when password reset/change flows are implemented.

