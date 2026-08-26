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
pnpm exec nest g provider modules/example/example.repository --flat
```

The result starts with `example.module.ts`, `example.controller.ts`, and
`example.service.ts`. Keep Zod schemas and inferred DTO types in `dto/`; the
generated DTO class is only a file scaffold and should not introduce
`class-validator`, `class-transformer`, or a duplicate Prisma entity.

For ordinary database access, rename the generated provider class to
`ExampleRepository`, inject `DatabaseContext`, and put the Prisma calls directly
in that class. Register it only in `ExampleModule`; do not export it. Add a
separate interface and adapter only when there is a real interchangeable
external boundary or more than one proven implementation.

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
4. Add the minimum operation to `<feature>.repository.ts` (or
   `repositories/<aggregate>.repository.ts` in a large feature). Scope every
   tenant-owned query by trusted `workspaceId`.
5. Register the concrete repository in the feature module. Do not export it.
6. Export the service only when another module has a proven need for it.

The normal flow is:

```text
controller -> service -> repository -> DatabaseContext -> Prisma
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
