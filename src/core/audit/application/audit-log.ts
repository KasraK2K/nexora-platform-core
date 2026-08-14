import { Inject, Injectable } from '@nestjs/common';

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

/** Application facade for recording workspace-scoped security facts. */
@Injectable()
export class AuditLog {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly repository: AuditLogRepository,
  ) {}

  /**
   * Appends through the ambient transaction so callers can commit the audit
   * fact atomically with the protected state change.
   */
  append(input: AppendAuditLog): Promise<void> {
    return this.repository.append(input);
  }
}
