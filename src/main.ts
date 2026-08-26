import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { AppConfig } from './config/app-config';
import { JsonLogger } from './common/logging/json-logger';

/**
 * Starts the HTTP application with the same logger and global configuration
 * used for every request, then listens on the configured public port.
 */
async function bootstrap(): Promise<void> {
  const logger = new JsonLogger();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger,
  });
  configureApp(app);
  const config = app.get(AppConfig);
  await app.listen(config.port, '0.0.0.0');
}

void bootstrap().catch((error: unknown) => {
  new JsonLogger().fatal({
    event: 'application.startup_failed',
    errorType: error instanceof Error ? error.name : 'UnknownError',
  });
  process.exitCode = 1;
});
