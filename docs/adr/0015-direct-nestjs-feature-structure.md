# ADR-0015: Direct NestJS feature structure

- Status: Accepted
- Date: 2026-08-26
- Owners: Nexora Platform Core maintainers
- Supersedes: ADR-0014
- Related decisions: ADR-0010, ADR-0012

## Context

ADR-0014 created a conventional NestJS shell but retained mandatory
`application`, `domain`, `infrastructure`, `ports`, and `repositories` layers
inside most features. It also required an interface, injection symbol,
`Prisma...Repository` adapter, and `useExisting` binding for every module-owned
database repository.

Those boundaries protect important concerns in some places, but applying them
to every ordinary database class made the repository harder to navigate. A new
contributor had to open several files to discover that one fixed private class
was the only implementation. The same vocabulary also obscured familiar NestJS
controller, service, provider, guard, and module roles.

## Decision drivers

- Make the source tree understandable from filenames without teaching a custom
  architecture vocabulary first.
- Keep ordinary Nest CLI generation useful without custom schematics.
- Remove abstractions that have one fixed internal implementation.
- Preserve the boundaries that carry real security, transaction, provider, or
  dependency-cycle value.

## Decision

Use a direct, feature-first NestJS structure.

- Small features place their module, controller, service, concrete repository,
  errors, and public types at the feature root. DTOs remain in `dto/`.
- Complex features may group files by their concrete NestJS or capability role,
  such as `controllers/`, `services/`, `repositories/`, `guards/`, `security/`,
  `errors/`, `mail/`, or `session-state/`.
- Generic `application`, `domain`, `presentation`, `infrastructure`, and `ports`
  folders are not mandatory. A folder name must explain what the files do.
- A normal module-owned database class is one private concrete
  `<Feature>Repository`. It injects `DatabaseContext` so it participates in the
  caller-owned transaction. It is registered directly as a Nest provider and
  is never exported.
- Keep an abstraction only for a transaction boundary, external provider,
  volatile policy, disposable cache, or deliberately narrow cycle breaker.
  Current examples are the transaction manager, password cryptography,
  compromised-password screening, Redis-backed rate limiters and session cache,
  outbound mail, and mail payload protection.
- Public cross-module access remains limited to explicitly exported focused
  services. Modules never import another module's repository or query its
  tables.
- Controllers remain thin and cannot import Prisma, `DatabaseContext`, a
  repository, or another module's internal files.
- Oversized workflow services are split by capability. Controllers and real
  consumers inject the owning service directly; forwarding facades are not
  retained.

`DatabaseContext`, the serializable transaction manager, the narrow
`SessionStateService`, the authorization policy module, and the single global
route-admission guard remain. Their structure protects behavior rather than
mirroring an abstract layer diagram.

## Consequences

### Positive

- Most request flows read as controller -> service -> repository.
- A repository is one real class instead of an interface, symbol, adapter, and
  binding that all change together.
- Folder and injectable names follow familiar NestJS roles.
- Complex authentication and membership workflows stay focused without a
  generic use-case or facade layer.

### Negative and tradeoffs

- Internal TypeScript paths and provider class names change atomically.
- Concrete private repositories couple Platform Core to its accepted Prisma
  persistence implementation. Replacing the database would require an explicit
  foundation change, which is appropriate for this private monolith.
- Tests that directly construct services must use real service instances or
  explicitly typed test doubles rather than relying on production `Pick<>`
  constructor types.

## Compatibility

HTTP routes, request and response fields, status codes, OpenAPI, stable error
codes, cookies, token formats, Redis keys, environment variables, audit actions,
logs, provider behavior, and mail semantics do not change. The Prisma schema,
tables, stored data, isolation level, and outbox state machine do not change.

## Security, privacy, and tenancy

Route admission remains deny by default and is installed once. Application
services retain trusted server-resolved actor/workspace context, authorization
and membership rechecks inside transactions, hashed opaque tokens, session
rotation/revocation, safe errors, and redacted logs. PostgreSQL remains session
authority and Redis remains disposable.

Mail retains encrypted payloads, transactional enqueue, fenced claims, bounded
retry, terminal payload erasure, and at-least-once delivery semantics.

## Verification

- Architecture tests enforce concrete-repository privacy, table ownership,
  controller restrictions, narrow module exports, explicit route-module
  composition, an acyclic module graph, and exactly one global guard.
- Focused unit and E2E tests preserve authentication, tenancy, transactions,
  sessions, memberships, and mail behavior.
- The Nest CLI smoke check verifies feature module, controller, service, DTO,
  and concrete repository-provider targeting.
- OpenAPI and Prisma schema remain unchanged.

## Rollout and rollback

Apply repository consolidation, naming moves, workflow splits, test splits, and
documentation updates in reviewable slices. Rollback is a source revert; no
database or Redis reset is required.

## Follow-up work

- [ ] Reassess a custom generator only after repeated measured need.
- [ ] Reassess the monorepo target only when ADR-0010 triggers are met.
