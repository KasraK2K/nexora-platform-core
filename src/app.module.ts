import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthenticationModule } from './modules/authentication/authentication.module';
import { AuthorizationModule } from './modules/authorization/authorization.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { HealthModule } from './modules/health/health.module';
import { ObservabilityModule } from './modules/observability/observability.module';
import { HttpTelemetryMiddleware } from './modules/observability/http-telemetry.middleware';
import { RequestIdMiddleware } from './common/http/request-id.middleware';
import { SecurityHeadersMiddleware } from './common/http/security-headers.middleware';
import { AuditModule } from './modules/audit/audit.module';
import { MailModule } from './modules/mail/mail.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { UsersModule } from './modules/users/users.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';

/**
 * Composes the deployable Platform Core application and installs middleware in
 * the order in which every HTTP request must pass through it.
 */
@Module({
  imports: [
    InfrastructureModule,
    ObservabilityModule,
    HealthModule,
    AuthenticationModule,
    AuthorizationModule,
    AuditModule,
    MailModule,
    MembershipsModule,
    SessionsModule,
    UsersModule,
    WorkspacesModule,
  ],
})
export class AppModule implements NestModule {
  /** Applies security headers, request context, and telemetry to every route. */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(
        SecurityHeadersMiddleware,
        RequestIdMiddleware,
        HttpTelemetryMiddleware,
      )
      .forRoutes('*');
  }
}
