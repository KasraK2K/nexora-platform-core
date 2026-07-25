import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../persistence/database-context';
import type {
  AppendAuditLog,
  AuditLogRepository,
} from '../application/audit-log';

@Injectable()
export class PrismaAuditLogRepository implements AuditLogRepository {
  constructor(private readonly database: DatabaseContext) {}

  async append(input: AppendAuditLog): Promise<void> {
    await this.database.client.auditLog.create({ data: input });
  }
}
