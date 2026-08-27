# Core glossary

| Term | Meaning |
| --- | --- |
| User | Account, normalized email, Argon2id password, profile, and verification status. |
| Workspace | Independent operational tenant with one permanent `ownerUserId`. |
| Membership | Active or soft-removed user access to one workspace. It stores no role. |
| Invitation | Hashed, expiring, email-bound grant of MEMBER access to one workspace. |
| Session | Opaque hashed server session for one user and one active `workspaceId`. |
| OWNER | Public role derived when `user.id === workspace.ownerUserId`. |
| MEMBER | Public role derived for every other active membership. |
| Route admission | Deny-by-default metadata declaring public or authenticated access. |
| Trusted context | Immutable server-resolved session ID, user ID/status, and workspace ID. |
| Repository | Private concrete class containing one feature's Prisma queries. |
| Durable outbox | Encrypted database handoff committed before asynchronous mail delivery. |

## Important distinctions

- A cookie contains an opaque secret; PostgreSQL stores only its hash.
- A membership grants access; workspace ownership grants management authority.
- A route permission is a named action; it is evaluated against derived
  OWNER/MEMBER state and rechecked in the service for sensitive writes.
- Redis stores rate-limit counters. It does not grant session authority.
- An API saying `EmailQueued` means the transaction committed an outbox row; the
  worker remains responsible for provider delivery and retries.
