# Authentication module map

Authentication is the largest feature because it protects several independent
account workflows. Start with `authentication.module.ts`, then follow only the
route you are changing. Controllers stay thin; each focused service owns one
workflow and calls another module only through its exported service.

| HTTP workflow | Controller | Service | Main collaborators |
| --- | --- | --- | --- |
| Register | `registration.controller.ts` | `RegistrationService` | Users, Workspaces, Memberships, Sessions, Audit, Mail |
| Request or confirm verification | `email-verification.controller.ts` | `EmailVerificationService` | Users, Audit, Mail |
| Log in | `session-login.controller.ts` | `SessionLoginService` | Users, Memberships, Workspaces, Sessions, Audit |
| Read current session | `session-context.controller.ts` | `SessionContextService` | Sessions, Users, Memberships, Workspaces |
| Log out or revoke all sessions | `session-management.controller.ts` | `SessionManagementService` | Sessions, Audit |
| List or switch workspaces | `workspace-session.controller.ts` | `WorkspaceSessionService` | Users, Memberships, Workspaces, Sessions, Audit |
| Request or confirm password reset | `password-reset.controller.ts` | `PasswordResetService` | Users, Sessions, Audit, Mail |
| Change password | `password-change.controller.ts` | `PasswordChangeService` | Users, Memberships, Sessions, Audit |

## Request order

```text
route-admission guard
  -> workflow rate-limit guard when required
  -> controller and Zod DTO
  -> focused service
  -> owning module services or private concrete repository
```

The guards run before expensive password hashing or token processing. Services
recheck authoritative session, user, membership, and workspace state inside
their transaction before security-sensitive writes.

## Where private details live

- `dto/`: Zod request schemas and inferred transport types.
- `guards/`: trusted-origin, authenticated-context, and named workflow limits.
- `repositories/`: concrete persistence for verification and reset records.
- `rate-limit/`: feature policy over the shared Redis fixed-window engine.
- `mail/`: verification and password-reset outbox payload construction.
- `security/`: password policy and trusted request-context types.
- `http/`: secure session-cookie mapping.

Do not merge these workflows into one catch-all authentication service and do
not call another module's repository or Prisma delegate directly.
