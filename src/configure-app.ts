import type { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import {
  DocumentBuilder,
  type OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';
import { ApiExceptionFilter } from './shared/presentation/api-exception.filter';
import { AppConfig } from './core/configuration/app-config';

/**
 * Applies process-wide HTTP behavior to a newly created Nest application.
 *
 * This is where proxy trust, CORS, safe error responses, shutdown hooks, and
 * the optional Swagger UI are configured. Call it before the server listens.
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(AppConfig);
  app.disable('x-powered-by');
  app.set(
    'trust proxy',
    config.trustedProxies.length === 0 ? false : config.trustedProxies,
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
  app.enableCors({
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'content-type',
      'x-request-id',
      'x-correlation-id',
      'traceparent',
    ],
    origin(origin, callback) {
      callback(null, origin === undefined || config.allowedOrigins.has(origin));
    },
  });

  if (config.apiDocsEnabled) {
    const document = createOpenApiDocument(app);
    SwaggerModule.setup('docs', app, document);
  }
}

/**
 * Builds the OpenAPI description used by both Swagger UI and the committed
 * contract generator. Creating the document does not start an HTTP server.
 */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = app.get(AppConfig);
  const openApiConfig = new DocumentBuilder()
    .setTitle('Nexora Platform Core API')
    .setVersion('1')
    .addCookieAuth(config.sessionCookieName)
    .build();
  return SwaggerModule.createDocument(app, openApiConfig);
}
