import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { MetricsController } from './metrics.controller';
import { ObservabilityService } from './observability.service';
import { HttpTelemetryMiddleware } from './http-telemetry.middleware';

/** Provides in-process operational counters, HTTP telemetry, and metrics output. */
@Module({
  imports: [InfrastructureModule],
  controllers: [MetricsController],
  providers: [ObservabilityService, HttpTelemetryMiddleware],
  exports: [ObservabilityService, HttpTelemetryMiddleware],
})
export class ObservabilityModule {}
