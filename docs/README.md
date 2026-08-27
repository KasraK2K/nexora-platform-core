# Documentation map

Read the smallest document that answers the current question:

1. [Project tour](getting-started/project-tour.md) — five concepts and one real request.
2. [Architecture overview](concepts/architecture-overview.md) — module, data, transaction, and security boundaries.
3. [Module catalog](modules/README.md) — which module owns each concept and table.
4. [Registration flow](flows/registration.md) — account creation and queued mail.
5. [Protected request flow](flows/protected-request-admission.md) — cookie to trusted workspace context.
6. [Create a module](how-to/create-a-module.md) — normal Nest CLI commands.
7. [Tenant isolation matrices](architecture/tenant-isolation-matrices.md) — required positive and tenant A/B evidence.
8. [OpenAPI guide](reference/openapi.md) and [contract](reference/openapi.json).
9. [ADRs](adr/) — why accepted architecture decisions exist.

The generated Compodoc output is for navigation. These Markdown documents are
the source of truth for purpose, ownership, invariants, and failure behavior.
