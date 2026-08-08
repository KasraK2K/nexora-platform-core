import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiExceptionFilter } from './shared/presentation/api-exception.filter';
import { AppConfig } from './core/configuration/app-config';

export function configureApp(app: NestExpressApplication): void {
  const config = app.get(AppConfig);
  app.set(
    'trust proxy',
    config.trustedProxies.length === 0 ? false : config.trustedProxies,
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();

  const openApiConfig = new DocumentBuilder()
    .setTitle('Nexora Platform Core API')
    .setVersion('1')
    .addCookieAuth(config.sessionCookieName)
    .build();
  const document = SwaggerModule.createDocument(app, openApiConfig);
  SwaggerModule.setup('docs', app, document);
}
