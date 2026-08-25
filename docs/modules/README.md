# Feature module catalog

This catalog describes current ownership. Verify it against source, schema, and
tests when changing behavior.

| Module         | Owns                                                                                                                                          | Exported service surface                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Identity       | `Identity`, `PasswordCredential`; normalized sign-in identity and credential operations                                                       | `IdentityService`, `PasswordCredentialsService`                                       |
| Authentication | `Session`, `EmailVerification`, `PasswordResetToken`; registration, verification, password, login, workspace selection, and session lifecycle | Context/origin guards; nested `SessionStateService` is the cross-module cycle breaker |
| Users          | `User`; profile and user lifecycle                                                                                                            | `UsersService`                                                                        |
| Organizations  | `Organization`; commercial ownership record                                                                                                   | `OrganizationsService`                                                                |
| Workspaces     | `Workspace`; operational tenant record and workspace lifecycle                                                                                | `WorkspacesService`                                                                   |
| Memberships    | `Membership`, `MembershipInvitation`; role, invitation, administration, ownership transfer, and leave policy                                  | `MembershipsService`, `MembershipInvitationsService`                                  |
| Authorization  | Permission catalog, role mapping, and deny-by-default route admission                                                                         | Nested `AuthorizationPolicyService`; one global admission guard                       |
| Audit          | `AuditLog`; append-oriented security and lifecycle facts                                                                                      | `AuditService`                                                                        |
| Mail           | `MailOutboxMessage`; encrypted durable email handoff, claiming, retry, and Resend delivery                                                    | `MailService`; provider-neutral ports remain private                                  |
| Health         | Liveness/readiness endpoints and dependency shutdown                                                                                          | `HealthService`                                                                       |
| Observability  | Request telemetry, metrics, and safe operational counters                                                                                     | `ObservabilityService` and HTTP middleware                                            |

`src/config` owns validated runtime configuration. `src/infrastructure` owns
Prisma, transaction context, and Redis lifecycle. Neither is a business feature
or a surface for downstream product modules.

## Ownership rules

- The owner controls the model, business rules, application ports, repository
  adapter, schema changes, and public contract.
- Another module calls only an exported `*Service`. It does not import the
  owner's repository, infrastructure, or Prisma delegate.
- Core exposes only product-neutral contracts. Provider SDK and product policy
  types must not leak through them.
- Tenant-owned methods accept trusted `workspaceId` scope or an immutable
  authenticated context.
- Cross-module writes remain coordinated by the calling application service;
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
