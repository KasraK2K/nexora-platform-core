# Nexora AI

Nexora is a modular NestJS monolith being built toward the architecture in
`docs/architecture/ai-saas-platform-baseline.md`. The repository remains a
single application; the target pnpm/Turborepo migration has not been performed.

## Implemented

- `POST /v1/auth/registrations` creates a password identity, user,
  organization, initial workspace, OWNER membership, opaque session, and audit
  entry in one PostgreSQL transaction.
- `GET /v1/auth/session` resolves the authenticated user and server-trusted
  active workspace from the opaque session cookie.
- Passwords use Argon2id. Only a SHA-256 session-token digest is stored;
  PostgreSQL is authoritative and Redis is a disposable lookup cache.
- Registration validates the exact browser Origin and applies Redis-backed IP
  and normalized-email rate limits before password hashing.
- OpenAPI UI is served at `/docs` while the application is running.

Email verification, login, logout, password reset, invitations, and additional
workspace membership management are not implemented yet.

> Registration currently activates the account and issues a session before
> mailbox verification. Do not expose it as public production signup until an
> email provider, hashed verification-token flow, and enumeration-resistant
> response contract are implemented.

## Prerequisites

- Node.js 24
- pnpm 10.32.1 through Corepack
- Docker with Docker Compose

## Local development

```bash
copy .env.example .env
pnpm install
pnpm run db:dev:up
pnpm run db:deploy
pnpm run start:dev
```

The local PostgreSQL port is `55432`; Redis uses `56379`.
`TRUST_PROXY` is empty locally. Set it to the exact trusted Caddy address or
subnet in a proxied deployment; never use an unrestricted proxy setting.

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
```

`test:e2e` starts isolated PostgreSQL and Redis services on ports `55433` and
`56380`, synchronizes the database from `prisma/schema.prisma` with
`prisma db push`, and runs the API suite. Stop them with:

```bash
pnpm run db:test:down
```
