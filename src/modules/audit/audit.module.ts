import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { AuditRepository } from './audit.repository';

/** Exposes the Audit facade while keeping its Prisma adapter private. */
@Module({
  imports: [InfrastructureModule],
  providers: [AuditService, AuditRepository],
  exports: [AuditService],
})
export class AuditModule {}
