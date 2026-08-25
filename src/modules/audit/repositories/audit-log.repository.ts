/** Injection token for the Audit-owned append adapter. */
export const AUDIT_LOG_REPOSITORY = Symbol('AUDIT_LOG_REPOSITORY');

/** Stable actor/action/resource facts for one workspace-scoped audit entry. */
export type AppendAuditLog = {
  id: string;
  workspaceId: string;
  actorUserId: string;
  action: string;
  resourceId: string;
};

/** Append-only storage boundary for Audit-owned records. */
export interface AuditLogRepository {
  /** Persists one immutable audit record through the ambient transaction. */
  append(input: AppendAuditLog): Promise<void>;
}
