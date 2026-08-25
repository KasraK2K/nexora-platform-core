# Create a module and add an endpoint

Use the installed Nest CLI. The repository has no parent module inside
`src/modules`, so a new feature module is registered with `AppModule`; files
generated inside an existing feature are registered with that feature module.

## Create the conventional shell

```powershell
pnpm exec nest g module modules/example
pnpm exec nest g controller modules/example --flat
pnpm exec nest g service modules/example --flat
pnpm exec nest g class modules/example/dto/create-example.dto --flat
pnpm exec nest g interface modules/example/repositories/example.repository --flat
pnpm exec nest g provider modules/example/infrastructure/prisma-example.repository --flat
Move-Item -LiteralPath src/modules/example/repositories/example.repository.interface.ts -Destination src/modules/example/repositories/example.repository.ts
```

The result starts with `example.module.ts`, `example.controller.ts`, and
`example.service.ts`. Keep Zod schemas and inferred DTO types in `dto/`; the
generated DTO class is only a file scaffold and should not introduce
`class-validator`, `class-transformer`, or a duplicate Prisma entity.

The installed Nest interface schematic always appends `.interface.ts`. The
explicit `Move-Item` keeps the repository contract at the project convention
`repositories/<aggregate>.repository.ts`; then place the injection token beside
the interface. This is the only filename correction and does not require a
custom schematic.

Do not use `nest g resource` for tenant-sensitive features. Generated CRUD
cannot infer trusted workspace scope, permission checks, transaction ownership,
audit behavior, or idempotency.

Run `pnpm run check:nest-cli` to verify generator targeting without writing
files.

## Add an endpoint

1. Declare a strict Zod request schema in `dto/<action>.dto.ts` and infer the
   TypeScript DTO from it.
2. Add the route to the feature controller. Validate the DTO, attach explicit
   route-admission metadata, invoke one service method, and map the response.
3. Put the workflow in the feature service. The service owns authorization
   rechecks, the transaction, audit writes, and reliable post-commit handoff.
4. Add or extend a narrow interface in `repositories/`. Keep its injection token
   beside the interface.
5. Implement the interface in `infrastructure/prisma-<aggregate>.repository.ts`
   and bind the token in the feature module. Do not export the repository.
6. Export the service only when another module has a proven need for it.

The normal flow is:

```text
controller -> service -> repository interface -> Prisma implementation
```

## Authenticated and tenant-owned operations

An endpoint that reads or changes protected state also needs all of the
following:

- `@AuthenticatedRoute(...)` or the correct explicit admission decorator;
- trusted `AuthenticatedRequestContext` from the server-side decorator, never a
  client-selected workspace header;
- a transaction-time session and membership recheck for sensitive writes;
- server-side action and resource authorization, denied by default;
- `workspaceId` on every tenant-owned repository read and write;
- a tenant A versus tenant B rejection test;
- stable safe errors, an audit event, and post-commit side effects where needed.

Changing authentication, tenant boundaries, or an accepted architecture
decision requires an ADR before implementation.

## Verify the change

At minimum run:

```powershell
pnpm run check:nest-cli
pnpm run format:check
pnpm run lint:check
pnpm run typecheck
pnpm run test:architecture
pnpm run test --runInBand
pnpm run contract:check
pnpm run docs:check
pnpm run build
```

For API, authentication, tenancy, session, transaction, or persistence changes,
also run the relevant E2E coverage.
