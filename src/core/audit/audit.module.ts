import { Module } from '@nestjs/common';
import { AUDIT_LOG_REPOSITORY, AuditLog } from './application/audit-log';
import { PrismaAuditLogRepository } from './infrastructure/prisma-audit-log.repository';
import { CoreInfrastructureModule } from '../core-infrastructure.module';

/** Exposes the Audit facade while keeping its Prisma adapter private. */
@Module({
  imports: [CoreInfrastructureModule],
  providers: [
    AuditLog,
    PrismaAuditLogRepository,
    { provide: AUDIT_LOG_REPOSITORY, useExisting: PrismaAuditLogRepository },
  ],
  exports: [AuditLog],
})
export class AuditModule {}
