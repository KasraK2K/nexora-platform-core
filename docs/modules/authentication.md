# Authentication module

Authentication coordinates User credentials and durable Sessions. It owns only
verification and reset token records; Users owns email/password state and
Sessions owns the `Session` table.

## Workflows

- Registration creates User, owner Workspace, Membership, verification token,
  Session, audit rows, and encrypted outbox mail atomically.
- Email verification replaces/consumes hashed single-use tokens.
- Login authenticates through `UsersService` and selects one accessible
  workspace.
- Workspace switching rotates the session only when the workspace changes.
- Password change verifies the current hash, replaces it optimistically,
  revokes all sessions, and creates one replacement session atomically.
- Password reset is enumeration-resistant, consumes one token, replaces the
  password, and revokes every session.
- Logout and revoke-all update durable session state and audit records.

## Internal structure

`controllers/` maps the `/v1/auth` routes. `services/` contains focused workflow
services. `repositories/` contains private token repositories. `guards/` owns
trusted-origin, rate-limit, and request-context admission helpers. No nested
session-state module or Redis session cache exists.

## Invariants

- PostgreSQL is authoritative for sessions.
- Raw session, verification, and reset tokens are never stored or logged.
- Passwords are NFC-normalized, bounded to 15–128 code points and 512 UTF-8
  bytes, and hashed with Argon2id.
- Pending users reach only explicitly allowed routes.
- Exact trusted-origin validation precedes protected browser mutations.
- Multi-workspace login returns `409 WORKSPACE_SELECTION_REQUIRED` without
  creating a session when no workspace was selected.
- Mail creation is transactional and reports queued state only; the worker owns
  delivery.
- Session rotation never extends absolute expiry.

See [registration](../flows/registration.md),
[protected request admission](../flows/protected-request-admission.md), and the
[OpenAPI contract](../reference/openapi.json).
