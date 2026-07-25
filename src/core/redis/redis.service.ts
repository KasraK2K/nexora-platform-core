import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { AppConfig } from '../configuration/app-config';

@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  readonly client: RedisClientType;

  constructor(config: AppConfig) {
    this.client = createClient({ url: config.redisUrl });
  }

  async onModuleInit(): Promise<void> {
    this.client.on('error', () => undefined);
    await this.client.connect();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }
}
