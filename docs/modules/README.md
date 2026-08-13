# Core module catalog

This catalog describes current ownership. Verify it against source, schema, and
tests when changing behavior.

| Module         | Owns                                                                                                                                                       | Public application surface                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Identity       | `Identity`, `PasswordCredential`; normalized sign-in identity and credential operations                                                                    | Identity lookup, registration, password authentication, credential verification and replacement |
| Authentication | `Session`, `EmailVerification`, `PasswordResetToken`; registration, verification, login, workspace selection, password change/reset, and session lifecycle | Authenticated request guard/context plus internal session-state contracts                       |
| Users          | `User`; profile and user lifecycle                                                                                                                         | `Users` and update-own-profile use case                                                         |
| Organizations  | `Organization`; commercial ownership record                                                                                                                | `Organizations`                                                                                 |
| Workspaces     | `Workspace`; operational tenant record and workspace lifecycle                                                                                             | `Workspaces` and rename-current-workspace use case                                              |
| Memberships    | `Membership`, `MembershipInvitation`; role, invitation, administration, ownership transfer, and leave policy                                               | `Memberships`; HTTP-facing membership use cases                                                 |
| Authorization  | Permission catalog, role mapping, and deny-by-default route admission                                                                                      | `AuthorizationPolicy`; global admission guard                                                   |
| Audit          | `AuditLog`; append-oriented security and lifecycle facts                                                                                                   | `AuditLog`                                                                                      |
| Mail           | `MailOutboxMessage`; encrypted durable email handoff, claiming, retry, and SMTP delivery                                                                   | `MailOutbox` and provider-neutral outbound-mail token                                           |
| Configuration  | Validated runtime configuration and security policy                                                                                                        | `AppConfig`, `SECURITY_POLICY`                                                                  |
| Persistence    | Prisma lifecycle, transaction context, and serializable transaction manager                                                                                | Infrastructure only; never expose it to products                                                |
| Redis          | Redis connection lifecycle for cache and rate-limit adapters                                                                                               | Infrastructure only                                                                             |
| Health         | Liveness/readiness contracts and dependency health                                                                                                         | Health controller and dependency health service                                                 |
| Observability  | Request telemetry, metrics, and safe operational counters                                                                                                  | Telemetry and HTTP middleware                                                                   |

## Ownership rules

- The owner controls the model, business rules, application ports, repository
  adapter, schema changes, and public contract.
- Another module calls only an exported application contract. It does not import
  the owner's infrastructure or use its Prisma delegate.
- Core exposes only product-neutral contracts. Provider SDK and product policy
  types must not leak through them.
- Tenant-owned methods accept trusted `workspaceId` scope or an immutable
  authenticated context.
- Cross-module writes remain coordinated by the calling application use case;
  ownership does not imply a separate service or internal HTTP request.

## Module guide checklist

When adding or updating a module guide, include:

1. purpose and explicit non-goals;
2. owned models and business rules;
3. exported contracts and known consumers;
4. layer-by-layer source map;
5. transaction and reliable-side-effect boundaries;
6. trusted tenant context and authorization rules;
7. stable errors, logging, privacy, and operational behavior;
8. unit, architecture, integration, and E2E evidence;
9. planned work clearly separated from implemented behavior.

The [Authentication guide](authentication.md) is the first detailed example.
