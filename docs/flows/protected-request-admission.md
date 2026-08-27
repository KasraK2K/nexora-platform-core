# Protected request admission

Every controller handler must declare admission metadata. Missing or malformed
metadata is denied by the one global `RouteAdmissionGuard`.

```mermaid
sequenceDiagram
    actor Client
    participant Admission as RouteAdmissionGuard
    participant Origin as TrustedOriginGuard
    participant Context as AuthenticatedRequestContextGuard
    participant Sessions as SessionsService
    participant Features as User/Workspace/Membership services
    participant Controller

    Client->>Admission: request and opaque cookie
    Admission->>Admission: validate explicit route policy
    opt trusted origin required
        Admission->>Origin: compare exact Origin
    end
    opt authenticated route
        Admission->>Context: resolve cookie
        Context->>Sessions: load durable session by token hash
        Context->>Features: load active user, workspace, membership
        Features-->>Context: derived OWNER or MEMBER view
        Context-->>Admission: immutable trusted context
        Admission->>Admission: evaluate pure permission policy
    end
    Admission->>Controller: allow
```

The trusted context contains only session ID, actor user ID/status, and
workspace ID. It is created from PostgreSQL records, never from client tenant or
role headers. Redis does not participate in session authority.

Admission is a coarse check. Sensitive services revalidate the exact durable
session, active membership, workspace ownership, and resource scope inside the
transaction. This protects against stale request snapshots and tenant A/B
identifier substitution.

Code: route decorators, `RouteAdmissionGuard`,
`AuthenticatedRequestContextGuard`, `SessionContextService`, and the pure
`authorization.policy.ts` functions.
