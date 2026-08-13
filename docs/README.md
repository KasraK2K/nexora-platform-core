# Nexora Platform Core documentation

This is the starting point for understanding and changing Nexora Platform Core.
The documentation separates four different needs so generated reference pages
do not get confused with architectural explanations.

## Start here

1. Read the [project tour](getting-started/project-tour.md) to learn the source
   layout and follow one HTTP request through the application.
2. Read the [architecture overview](concepts/architecture-overview.md) for the
   module, layer, transaction, and product-boundary rules.
3. Use the [glossary](concepts/glossary.md) when identity, user, organization,
   workspace, membership, or session terms are unclear.
4. Open the [module catalog](modules/README.md), then read the
   [Authentication module guide](modules/authentication.md).
5. Trace the [registration](flows/registration.md) and
   [protected-request admission](flows/protected-request-admission.md) flows.

## Documentation map

| Need              | Documentation                                                                         | Purpose                                                  |
| ----------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Learn the system  | [`getting-started/`](getting-started/project-tour.md)                                 | Guided reading paths and project orientation             |
| Understand why    | [`concepts/`](concepts/architecture-overview.md)                                      | Architecture, boundaries, invariants, and terminology    |
| Complete a task   | [`how-to/`](how-to/change-a-core-capability.md)                                       | Safe, goal-oriented change procedures                    |
| Look something up | [`modules/`](modules/README.md), [`reference/`](reference/openapi.md), [`adr/`](adr/) | Ownership, contracts, API shapes, and accepted decisions |

The [Platform Core baseline](architecture/platform-core-baseline.md) includes
both implemented and target architecture. It is not proof that a planned
component exists. The [downstream product guide](architecture/downstream-product-guide.md)
defines where customer-facing product behavior belongs.

## Sources of truth

Use these sources for different questions:

- **What exists now:** source code, tests, `prisma/schema.prisma`, active
  configuration, and the committed OpenAPI document.
- **Why a decision was accepted:** the relevant ADR under `docs/adr/`.
- **How the current system works:** the human-written guides under `docs/`.
- **What the platform is intended to become:** the architecture baseline,
  clearly separated from its current-state sections.
- **Where a symbol is declared or injected:** the generated Compodoc reference.

When documentation and executable behavior disagree, treat the disagreement as
a defect. Verify the code and tests, then update the stale documentation in the
same change.

## Generated references

### HTTP contract

The application serves Swagger UI at `/docs` outside production when
`API_DOCS_ENABLED` is enabled. The deterministic, committed contract is
[`reference/openapi.json`](reference/openapi.json). See the
[OpenAPI workflow](reference/openapi.md).

### NestJS code navigation

Compodoc generates an untracked, searchable view of modules, controllers,
injectables, interfaces, dependency graphs, and source links:

```bash
pnpm run docs:code
pnpm run docs:code:serve
```

The output is written to `documentation/`. Run `pnpm run docs:check` to verify
that the code reference still generates. Compodoc is navigation, not the
authority for business meaning or security policy.

## Writing and maintenance rules

- Document **why**, ownership, invariants, and failure behavior. Do not restate
  obvious TypeScript.
- Put public HTTP shapes in OpenAPI decorators and contract schemas.
- Put accepted architecture changes in an ADR before implementation.
- Add selective TSDoc to public application contracts and non-obvious security
  or transaction boundaries so Compodoc can show the constraint beside code.
- Every module guide should name its data owner, public contracts, consumers,
  transaction boundaries, tenant/security invariants, and behavioral tests.
- Every flow guide should link the controller, guards, use case, repositories,
  side effects, and tests, and should distinguish work inside and after commit.
- Update the nearest guide whenever a change invalidates it. Do not create empty
  documentation sections for planned capabilities.

Adopting this documentation workflow does not change runtime architecture or
the Core/downstream product boundary, so it does not require a new ADR.
