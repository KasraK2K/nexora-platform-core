import { Inject, Injectable } from '@nestjs/common';
import {
  AUDIT_LOG_REPOSITORY,
  type AppendAuditLog,
  type AuditLogRepository,
} from './repositories/audit-log.repository';

export type { AppendAuditLog } from './repositories/audit-log.repository';

/** Records workspace-scoped security facts through the active transaction. */
@Injectable()
export class AuditService {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly repository: AuditLogRepository,
  ) {}

  /** Appends an immutable audit fact atomically with the caller's state change. */
  append(input: AppendAuditLog): Promise<void> {
    return this.repository.append(input);
  }
}
