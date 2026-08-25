import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { AppConfig } from '../../config/app-config';

/** Owns the shared Redis client and its connection lifecycle. */
@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  readonly client: RedisClientType;

  constructor(config: AppConfig) {
    this.client = createClient({ url: config.redisUrl });
  }

  /** Connects to Redis and installs a redacted error listener at module startup. */
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

  /** Closes the Redis connection when it is open during shutdown. */
  async onApplicationShutdown(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.close();
    }
  }
}
