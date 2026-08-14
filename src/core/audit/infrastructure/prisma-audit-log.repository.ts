import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../persistence/database-context';
import type {
  AppendAuditLog,
  AuditLogRepository,
} from '../application/audit-log';

/** Prisma adapter that inserts immutable Audit-owned records. */
@Injectable()
export class PrismaAuditLogRepository implements AuditLogRepository {
  constructor(private readonly database: DatabaseContext) {}

  /** Inserts one workspace-scoped record through the ambient transaction. */
  async append(input: AppendAuditLog): Promise<void> {
    await this.database.client.auditLog.create({ data: input });
  }
}
