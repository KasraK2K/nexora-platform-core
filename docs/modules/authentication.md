# Authentication module

Authentication owns account-entry and session workflows. It coordinates several
Core modules but does not take ownership of their tables.

## Responsibilities

- register a password account and initial tenant graph;
- verify email ownership;
- request and complete password reset;
- authenticate and create an opaque session;
- change a password and rotate the current session;
- resolve, revoke, and switch the active workspace of sessions;
- enforce authentication-specific origin and rate-limit policies;
- issue hashed, expiring, replaceable, single-use verification/reset tokens.

It does not own user profiles, organization/workspace records, membership rules,
authorization policy, or generic mail delivery.

## Owned data

| Prisma model         | Purpose                                                                   |
| -------------------- | ------------------------------------------------------------------------- |
| `Session`            | Hashed opaque token, user, active workspace, expiry, and revocation state |
| `EmailVerification`  | Hashed single-use email proof and delivery state                          |
| `PasswordResetToken` | Hashed single-use credential-reset authority and delivery state           |

Identity owns `Identity` and `PasswordCredential`; Users, Organizations,
Workspaces, and Memberships own their corresponding records.

## Source map

- `controllers/` separates registration, verification, password reset,
  password change, login, session context, workspace selection, and session
  management while preserving the single `/v1/auth` contract.
- `services/` contains matching focused workflows and owns their transaction
  and authorization decisions.
- `dto/` holds strict Zod schemas and inferred transport types; `guards/`
  handles rate limits, origin, and route-admission prerequisites.
- `repositories/` contains private concrete database access for sessions and
  single-use tokens.
- `cache/`, `rate-limit/`, `security/`, and `mail/` name the supporting behavior
  directly.
- `security/password-policy.ts` and stable authentication errors hold reusable
  decisions without transport concerns.
- Concrete providers implement Redis cache/rate limits, Argon2, and Pwned
  Passwords lookup.
- `authentication.module.ts` is the composition root.
- `session-state/session-state.module.ts` exposes the narrower session state
  needed by Memberships without importing Authentication's full session
  workflows.

## Dependencies

Authentication consumes exported services from Identity, Users, Organizations,
Workspaces, Memberships, Audit, and Mail. Its private providers consume shared
database and Redis facilities. The module exports only the guards
needed to establish trusted request context and origin policy; other Core
modules receive session-state contracts through the dedicated session-state
module.

## Security and tenancy invariants

- Store only token hashes for sessions, verifications, and password resets.
- Never return or log raw verification/reset tokens. Deliver them through the
  encrypted mail outbox.
- PostgreSQL is authoritative for session validity. Redis failure cannot create
  or revoke durable authority.
- Resolve active workspace and membership server-side for every authenticated
  request; ignore client identity, role, and workspace headers.
- Validate exact browser origin before protected mutations when route policy
  requires it.
- Preserve enumeration-resistant responses for email verification and password
  reset requests.
- Keep password changes and resets transactional with the required credential,
  token, session, and audit mutations.
- Do not extend a session's absolute expiry when changing its workspace or
  rotating it after authenticated password change.

## Public HTTP contract

The canonical operation list and schemas are generated in
[`../reference/openapi.json`](../reference/openapi.json). The routes are grouped
under `/v1/auth`. Swagger UI is available at `/docs` in enabled non-production
environments.

## Behavioral evidence

- Service unit tests cover registration, verification, reset, login,
  password change, revocation, request-context resolution, and workspace switch.
- Guard tests cover route admission and authenticated-context attachment.
- Capability E2E specifications under `test/e2e/` cover the public API with
  PostgreSQL and Redis,
  including cross-tenant and forged-header denials.
- `docs/architecture/tenant-isolation-matrices.md` maps tenant-owned surfaces to
  positive and tenant A/B negative coverage.

For a chronological view, read the [registration flow](../flows/registration.md)
and [protected-request flow](../flows/protected-request-admission.md).
