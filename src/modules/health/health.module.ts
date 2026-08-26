import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { ObservabilityModule } from '../observability/observability.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

/** Wires public liveness/readiness endpoints to infrastructure health checks. */
@Module({
  imports: [InfrastructureModule, ObservabilityModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
