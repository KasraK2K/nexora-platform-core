import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { PrismaAuditLogRepository } from './infrastructure/prisma-audit-log.repository';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { AUDIT_LOG_REPOSITORY } from './repositories/audit-log.repository';

/** Exposes the Audit facade while keeping its Prisma adapter private. */
@Module({
  imports: [InfrastructureModule],
  providers: [
    AuditService,
    PrismaAuditLogRepository,
    { provide: AUDIT_LOG_REPOSITORY, useExisting: PrismaAuditLogRepository },
  ],
  exports: [AuditService],
})
export class AuditModule {}
