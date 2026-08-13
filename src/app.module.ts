import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthenticationModule } from './core/authentication/authentication.module';
import { AuthorizationModule } from './core/authorization/authorization.module';
import { CoreInfrastructureModule } from './core/core-infrastructure.module';
import { HealthModule } from './core/health/health.module';
import { ObservabilityModule } from './core/observability/observability.module';
import { HttpTelemetryMiddleware } from './core/observability/http-telemetry.middleware';
import { RequestIdMiddleware } from './shared/presentation/request-id.middleware';
import { SecurityHeadersMiddleware } from './shared/presentation/security-headers.middleware';

@Module({
  imports: [
    CoreInfrastructureModule,
    ObservabilityModule,
    HealthModule,
    AuthenticationModule,
    AuthorizationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(
        SecurityHeadersMiddleware,
        RequestIdMiddleware,
        HttpTelemetryMiddleware,
      )
      .forRoutes('*');
  }

  //
}
