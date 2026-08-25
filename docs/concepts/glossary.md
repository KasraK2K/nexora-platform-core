# Core glossary

These terms are deliberately distinct. Keeping them separate prevents security
and ownership mistakes.

| Term                          | Meaning                                                                                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity                      | A stable principal and its authentication methods. Identity owns normalized sign-in uniqueness and password credentials.                                       |
| User                          | The application profile and lifecycle record linked one-to-one to an identity. A user can belong to multiple workspaces.                                       |
| Organization                  | The commercial ownership boundary. It can contain multiple workspaces.                                                                                         |
| Workspace                     | The operational tenant boundary used to scope permissions and tenant-owned data.                                                                               |
| Membership                    | The relationship between a user and a workspace, including OWNER, ADMIN, or MEMBER role and lifecycle state.                                                   |
| Session                       | An opaque, rotatable server session with one active workspace. PostgreSQL is authoritative; Redis is only a cache.                                             |
| Authenticated request context | Immutable server-resolved session, actor, user-status, organization, and workspace IDs attached after session validation.                                      |
| Route admission               | The deny-by-default declaration that decides whether a route is public, fully context-authenticated, or validated by a credential self-service use case.       |
| Permission                    | A named action checked against the authenticated membership role before the controller runs. Resource-specific policy can add stricter checks in the use case. |
| Application contract          | A narrow capability exposed by an owning module to other modules or downstream products. It is not a Prisma model.                                             |
| Repository port               | An interface defined inward, normally in application code, and implemented by infrastructure for an owned data surface.                                        |
| Transaction boundary          | The set of writes that an application service method commits or rolls back together.                                                                           |
| Durable outbox                | A database-backed handoff that records a side effect in durable state before delivery is attempted.                                                            |
| Platform Core                 | Reusable, product-neutral SaaS foundations owned by this repository.                                                                                           |
| Downstream product            | A separate repository that consumes Core and owns customer-facing workflows, providers, UI, prompts, evaluations, and product policy.                          |

## Easily confused pairs

### Identity versus user

Identity answers “who can authenticate?” User answers “what profile and
lifecycle does the application know?” Authentication methods can evolve without
turning profile data into credential state.

### Organization versus workspace

Organization answers commercial ownership questions. Workspace answers which
tenant's operational data and permissions apply to the current action.

### Session versus request context

The cookie contains an opaque raw token. Its digest finds a durable session. The
request context is constructed only after the session, user, active workspace,
membership, and organization are revalidated server-side.

### Role versus permission

A role is stored on a workspace membership. A permission names an action. The
authorization policy maps roles to permissions; service methods may still enforce
resource ownership, hierarchy, or last-owner rules.
