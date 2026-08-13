import { Module } from '@nestjs/common';
import { CoreInfrastructureModule } from '../core-infrastructure.module';
import { ObservabilityModule } from '../observability/observability.module';
import { DependencyHealthService } from './infrastructure/dependency-health.service';
import { HealthController } from './health.controller';
import { HealthLifecycleService } from './health-lifecycle.service';

@Module({
  imports: [CoreInfrastructureModule, ObservabilityModule],
  controllers: [HealthController],
  providers: [DependencyHealthService, HealthLifecycleService],
  exports: [DependencyHealthService],
})
export class HealthModule {}
