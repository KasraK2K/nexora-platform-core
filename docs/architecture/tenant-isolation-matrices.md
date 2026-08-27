# Tenant isolation matrices

Workspace is the only tenant boundary. Every row below requires both a positive
case and a tenant A versus tenant B rejection or concealment case.

## HTTP surfaces

| Route | Trusted scope | Required negative evidence |
| --- | --- | --- |
| `GET /v1/auth/session` | session `workspaceId` | forged headers cannot change context |
| `GET /v1/auth/session/workspaces` | authenticated user memberships | other users' workspaces omitted |
| `PUT /v1/auth/session/workspace` | active target membership | unknown/foreign workspace denied |
| `POST /v1/workspaces` | authenticated user | request cannot choose owner or switch session |
| `PATCH /v1/workspaces/current` | current workspace and permanent owner | MEMBER and foreign workspace denied |
| `GET /v1/memberships` | current workspace OWNER | MEMBER and foreign rows denied |
| `DELETE /v1/memberships/:id` | current workspace OWNER | foreign ID cannot remove tenant B |
| `DELETE /v1/memberships/me` | current workspace MEMBER | permanent owner cannot leave |
| invitation create/revoke | current workspace OWNER | MEMBER and foreign invitation denied |
| invitation acceptance | invitation workspace plus matching user email | token/email mismatch denied; session does not switch |

## Repository surfaces

| Owner | Scope rule |
| --- | --- |
| WorkspacesRepository | rename matches workspace ID and owner user ID |
| MembershipsRepository | reads/writes match workspace ID; public role is derived from workspace owner |
| MembershipInvitationsRepository | active lookup/revoke matches workspace ID; token acceptance uses stored workspace |
| SessionsRepository | context and revocation match exact user/workspace tuple |
| Authentication token repositories | tokens carry direct workspace attribution for audit |
| Audit/Mail repositories | every business record carries workspace ID |

Removal or leave revokes only sessions whose `workspaceId` equals the removed
membership. Other workspace sessions for the same user remain active.

Current executable coverage is under `test/e2e/lean-core.e2e-spec.ts` and
`test/e2e/security-and-mail.e2e-spec.ts`.
