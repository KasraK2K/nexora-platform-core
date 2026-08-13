# How to change a Core capability safely

Use this procedure for a bounded Platform Core change. Product-specific behavior
belongs in a downstream repository instead.

## 1. Establish current truth

Read the nearest module and flow guides, the applicable architecture baseline
sections, relevant ADRs, source, Prisma schema, configuration, and tests. Treat
planned baseline text as a target, not proof of implementation.

## 2. Classify ownership

Answer before editing:

- Is the outcome reusable Platform Core or a downstream product concern?
- Which module owns the rule and any affected Prisma models?
- Which application contract may consumers use?
- Which trusted actor/workspace context and permission apply?
- What must be atomic, idempotent, replay-safe, or delivered after commit?

Stop and write an ADR first if the change alters an accepted architecture,
authentication topology, ownership, public contract, product boundary, or
security/privacy boundary.

## 3. Trace the vertical slice

Work inward from the boundary:

1. transport schema and stable errors;
2. route admission, authentication context, permission, and resource policy;
3. one application use case that owns orchestration and transaction scope;
4. framework-independent domain rule where a real invariant exists;
5. narrow application port for an external or persistence boundary;
6. owning infrastructure adapter and Nest composition;
7. behavior-focused unit, architecture, and E2E coverage.

Do not introduce internal HTTP, a generic manager, direct cross-module Prisma
access, or a speculative interface.

## 4. Handle schema changes in development

Edit `prisma/schema.prisma` directly and use `pnpm run db:push`. Do not create a
migration directory or run `prisma migrate dev` until the user explicitly
announces the production transition. Stop if synchronization requires a reset
or data loss.

## 5. Update contracts and documentation

- Update Swagger operation/request/response/error annotations for HTTP changes.
- Run `pnpm run contract:generate` and review the OpenAPI diff.
- Update the owning module guide for ownership, contracts, invariants, or tests.
- Update or add a Mermaid flow when orchestration or transaction timing changes.
- Add selective TSDoc when a public contract carries a non-obvious security,
  transaction, failure, or compatibility constraint.
- Add or revise an ADR only when its decision trigger applies.

## 6. Verify

Run the checks relevant to the change. The complete repository set is:

```bash
pnpm run format:check
pnpm run lint:check
pnpm run typecheck
pnpm run check:deprecated
pnpm run contract:check
pnpm run docs:check
pnpm run test:architecture
pnpm run test --runInBand
pnpm run build
pnpm run test:e2e
```

The mutating `pnpm run lint` command may be used before final review, but inspect
its diff. E2E starts isolated PostgreSQL and Redis services and should be run
when API, persistence, transaction, tenancy, Redis, or adapter behavior changes.

## 7. Review the result

Confirm one owner per rule/table, inward dependencies, trusted workspace scope,
safe errors/logging, rollback compatibility, and no downstream product policy in
Core. Report schema, contract, security, operations, tests, assumptions, and
remaining risks.
