# Feature module catalog

| Module | Owns | Public capability |
| --- | --- | --- |
| Users | `User`, email normalization, Argon2id credentials, profile/status | `UsersService` |
| Workspaces | `Workspace`, permanent ownership, creation, rename | `WorkspacesService` |
| Memberships | `Membership`, `MembershipInvitation`, leave/removal/invites | `MembershipsService` |
| Sessions | `Session`, durable lookup and scoped revocation | `SessionsService` |
| Authentication | registration, verification, reset/change, login, workspace switching | request-context and origin guards |
| Authorization | global deny-by-default admission, pure OWNER/MEMBER policy | decorators and public denial contract |
| Mail | encrypted `MailOutboxMessage`, Resend adapter, worker/retry/fencing | `MailService` |
| Audit | workspace-scoped append-only `AuditLog` | `AuditService` |
| Health | liveness and dependency readiness | HTTP endpoints |
| Observability | request telemetry and optional metrics | middleware/endpoints |

## Communication rule

A module may call another module only through an exported service or intentional
public contract. Repositories and infrastructure adapters remain private. No
module queries another feature's table.

## Conventional layout

Small modules use root files:

```text
memberships/
  memberships.module.ts
  memberships.controller.ts
  memberships.service.ts
  memberships.repository.ts
  membership-invitations.controller.ts
  membership-invitations.service.ts
  membership-invitations.repository.ts
  dto/
  guards/
  rate-limit/
```

Larger Authentication and Mail modules use workflow folders, but each has one
root module. Generic `domain`, `application`, `presentation`, and feature-local
`infrastructure` layer folders are prohibited by architecture tests.
