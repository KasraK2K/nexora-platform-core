# Nexora Platform Core

Nexora is a product-neutral NestJS modular monolith for a small multi-workspace
team application. Its business model is intentionally limited to five concepts:

- **User**: account, email, password, profile, and verification state.
- **Workspace**: an independent tenant with one permanent owner.
- **Membership**: one user's access to one workspace.
- **Invitation**: one email invitation to one workspace.
- **Session**: one authenticated user working in one active workspace.

A user may own several workspaces, join other workspaces, and switch the active
workspace. `OWNER` and `MEMBER` are derived from `Workspace.ownerUserId`; they
are not stored roles. There is no Organization, ADMIN role, ownership transfer,
session cache, or compromised-password provider.

## Code shape

Every small feature starts with the normal Nest files:

```text
src/modules/users/
  users.module.ts
  users.controller.ts
  users.service.ts
  users.repository.ts
  dto/
```

The normal dependency flow is:

```text
controller -> service -> private concrete repository -> DatabaseContext -> Prisma
```

Controllers validate and map HTTP. Services own workflows, authorization
rechecks, transactions, audit writes, and durable side-effect handoffs.
Repositories contain private Prisma queries and are never exported. Interfaces
exist only for genuine external boundaries such as outbound mail.

Start with the [project tour](docs/getting-started/project-tour.md), then read
the [module catalog](docs/modules/README.md) and
[create-a-module guide](docs/how-to/create-a-module.md).

## Security retained by the lean design

- opaque, hashed, rotatable sessions in Secure/HttpOnly/SameSite cookies;
- PostgreSQL-authoritative session, membership, and tenant checks;
- deny-by-default route admission and exact trusted-origin checks;
- Argon2id password hashing, NFC normalization, and bounded password input;
- Redis-backed distributed rate limits, with one shared fixed-window engine;
- hashed single-use verification, reset, and invitation tokens;
- encrypted durable mail outbox with retries, fencing, and payload erasure;
- serializable transactions and workspace-scoped audit records;
- tenant A versus tenant B rejection coverage.

Mail HTTP workflows only enqueue. The mail worker is the sole delivery
authority; API metadata therefore says `*EmailQueued`, not `*EmailSent`.

## Main HTTP workflows

- Registration, verification, login, current session, logout, revoke-all,
  password reset, and authenticated password change remain under `/v1/auth`.
- `POST /v1/workspaces` creates another permanently owned workspace without
  changing the current session.
- `GET /v1/auth/session/workspaces` lists accessible workspaces and
  `PUT /v1/auth/session/workspace` explicitly switches the session.
- Invitations accept only `{ "email": "..." }` and always grant MEMBER access.
- Owners may invite, list, remove members, and rename their workspace. Owners
  cannot leave or be removed. Members may leave.

The intentionally breaking contract is committed at
`docs/reference/openapi.json`.

## Local development

Requirements: Node.js 24, pnpm 11.20.0, and Docker Compose.

```powershell
copy .env.example .env
pnpm install
pnpm run db:dev:up
pnpm run db:push
pnpm run db:seed
pnpm run start:dev
```

Development PostgreSQL uses `localhost:55432/nexora`; Redis uses
`localhost:56379`. The isolated test services use ports `55433` and `56380`.
Schema work remains development-only and uses guarded `prisma db push`; no
migration history is created until an explicit production transition.

Example registration:

```powershell
curl.exe -i http://localhost:3000/v1/auth/registrations `
  -H "Content-Type: application/json" `
  -H "Origin: http://localhost:3000" `
  -d '{"email":"owner@example.com","password":"A secure passphrase 123","displayName":"Owner","workspaceName":"Main"}'
```

Swagger UI is available at `http://localhost:3000/docs` when enabled.

## Verification

```powershell
pnpm run format:check
pnpm run lint:check
pnpm run typecheck
pnpm run check:deprecated
pnpm run check:operations
pnpm run check:production
pnpm run check:nest-cli
pnpm run test:architecture
pnpm run test --runInBand
pnpm run test:e2e
pnpm run contract:check
pnpm run docs:check
pnpm run build
git diff --check
```

## Product boundary

This repository owns reusable platform capabilities only. A downstream product
owns its product schema, workflow, providers, prompts, evaluation data, pricing,
and UI. Core never imports downstream product modules. See the
[baseline](docs/architecture/platform-core-baseline.md) and
[downstream product guide](docs/architecture/downstream-product-guide.md).
