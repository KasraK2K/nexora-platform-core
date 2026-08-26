import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../infrastructure/database/database-context';
import type { AppendAuditLog } from './audit.types';

/** Private append-only persistence service for Audit-owned records. */
@Injectable()
export class AuditRepository {
  constructor(private readonly database: DatabaseContext) {}

  /** Inserts one workspace-scoped record through the ambient transaction. */
  async append(input: AppendAuditLog): Promise<void> {
    await this.database.client.auditLog.create({ data: input });
  }
}
