/** Stable actor/action/resource facts for one workspace-scoped audit entry. */
export type AppendAuditLog = {
  id: string;
  workspaceId: string;
  actorUserId: string;
  action: string;
  resourceId: string;
};
