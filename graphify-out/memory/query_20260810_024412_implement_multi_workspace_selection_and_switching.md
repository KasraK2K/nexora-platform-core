---
type: "query"
date: "2026-08-10T02:44:12.773803+00:00"
question: "Implement Multi-workspace selection and switching task"
contributor: "graphify"
outcome: "useful"
source_nodes: ["WorkspacesModule", "Memberships", "AuthenticationSessions", "AuthenticatedRequestContext"]
---

# Q: Implement Multi-workspace selection and switching task

## Answer

Expanded from original query via graph vocabulary: workspace, workspaces, membership, memberships, session, sessions, context, selection, switch, resolve, active, audit. Implemented optional credentialed workspace selection, bounded actor-only workspace listing, and serializable per-session workspace switching with token rotation, membership revalidation, audit, rate limiting, and best-effort cache maintenance.

## Outcome

- Signal: useful

## Source Nodes

- WorkspacesModule
- Memberships
- AuthenticationSessions
- AuthenticatedRequestContext