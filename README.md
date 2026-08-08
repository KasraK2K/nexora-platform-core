# Nexora Platform Core

Nexora Platform Core is a reusable, product-neutral NestJS SaaS foundation.
Create a separate downstream repository from this base for each customer-facing
product. Product modules, provider integrations, prompts, evaluation data, and
product UI do not belong in this repository.

The target architecture is documented in
`docs/architecture/platform-core-baseline.md`. The repository currently remains
one NestJS modular monolith; the target pnpm/Turborepo structure has not been
implemented.

See `docs/architecture/downstream-product-guide.md` before creating a product
repository or changing runtime identifiers inherited from this base.

## Implemented

- `POST /v1/auth/registrations` creates a password identity, user,
  organization, initial workspace, OWNER membership, opaque session, and audit
  entry in one PostgreSQL transaction.
- `GET /v1/auth/session` resolves the authenticated user and server-trusted
  active workspace from the opaque session cookie.
- `POST /v1/auth/sessions` verifies a returning user's password and issues a
  fresh opaque session without accepting a client-selected workspace.
- `DELETE /v1/auth/session` idempotently revokes the presented session;
  `DELETE /v1/auth/sessions` revokes every session for the current user.
- Passwords use Argon2id. Only a SHA-256 session-token digest is stored;
  PostgreSQL is authoritative and Redis is a disposable lookup cache.
- New passwords are screened against a bundled common-password fallback and
  the free Pwned Passwords range API without transmitting plaintext passwords
  or complete password hashes.
- Session-creating and session-revoking requests validate the exact browser
  Origin. Registration and login use separate Redis-backed IP and
  normalized-email rate limits before expensive password work.
- OpenAPI UI is served at `/docs` while the application is running.

Email verification, password reset, invitations, authorization roles, and
additional workspace membership management are not implemented. Login refuses
an account with more than one eligible workspace until the multi-workspace
selection contract is defined.

> Registration currently activates the account and issues a session before
> mailbox verification. Do not expose it as public production signup until an
> email provider, hashed verification-token flow, and enumeration-resistant
> response contract are implemented.

## Product extension model

A downstream product repository should:

1. start from a reviewed Platform Core release;
2. rename its package and define its own product mission and roadmap;
3. add product capabilities under `src/products/<capability>` until a future
   monorepo layout is explicitly adopted;
4. consume Core modules only through public application contracts;
5. keep product schemas, provider adapters, prompts, evaluations, usage policy,
   and UI in the downstream repository;
6. record ADRs for new external-provider categories or changes to Core
   architecture decisions.

Platform Core must never import a downstream product module. Promote a product
capability into Core only after a second proven consumer or an explicit platform
requirement.

## Prerequisites

- Node.js 24
- pnpm 10.32.1 through Corepack
- Docker with Docker Compose

## Local development

```bash
copy .env.example .env
pnpm install
pnpm run db:dev:up
pnpm run db:push
pnpm run start:dev
```

The local PostgreSQL port is `55432`; Redis uses `56379`.
`TRUST_PROXY` is empty locally. Set it to the exact trusted proxy address or
subnet in a proxied deployment; never use an unrestricted proxy setting.
`PWNED_PASSWORDS_TIMEOUT_MS` bounds the optional remote breach lookup and must
remain between 100 and 5000 milliseconds. The local fallback remains active
when remote lookup is disabled or unavailable.

Example registration request:

```bash
curl -i http://localhost:3000/v1/auth/registrations \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"email":"owner@example.com","password":"A secure passphrase 123","displayName":"Owner","organizationName":"Example","workspaceName":"Main"}'
```

## Verification

```bash
pnpm run lint
pnpm run test --runInBand
pnpm run test:e2e
pnpm run build
pnpm run check:deprecated
```

Refresh the generated local password fallback from its documented free source
with `pnpm run update:password-blocklist`, then review the source checksum,
generated diff, and `THIRD_PARTY_NOTICES.md` before committing it.

`test:e2e` starts isolated PostgreSQL and Redis services on ports `55433` and
`56380`, synchronizes the database from `prisma/schema.prisma` with
`prisma db push`, and runs the API suite. Stop them with:

```bash
pnpm run db:test:down
```
