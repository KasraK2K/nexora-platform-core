import { Module } from '@nestjs/common';
import { CoreInfrastructureModule } from '../core-infrastructure.module';
import { MetricsController } from './metrics.controller';
import { OperationalTelemetry } from './application/operational-telemetry';
import { HttpTelemetryMiddleware } from './http-telemetry.middleware';

/** Provides in-process operational counters, HTTP telemetry, and metrics output. */
@Module({
  imports: [CoreInfrastructureModule],
  controllers: [MetricsController],
  providers: [OperationalTelemetry, HttpTelemetryMiddleware],
  exports: [OperationalTelemetry, HttpTelemetryMiddleware],
})
export class ObservabilityModule {}
