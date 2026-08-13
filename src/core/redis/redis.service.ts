import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { AppConfig } from '../configuration/app-config';

@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  readonly client: RedisClientType;

  constructor(config: AppConfig) {
    this.client = createClient({ url: config.redisUrl });
  }

  async onModuleInit(): Promise<void> {
    this.client.on('error', (error: unknown) => {
      this.logger.warn(
        JSON.stringify({
          event: 'redis.client_error',
          errorType: error instanceof Error ? error.name : 'UnknownError',
        }),
      );
    });
    await this.client.connect();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.close();
    }
  }
}
