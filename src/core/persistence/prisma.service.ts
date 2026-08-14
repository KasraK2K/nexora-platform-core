import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { AppConfig } from '../configuration/app-config';

/** Owns the process-wide Prisma client and its database connection lifecycle. */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnApplicationShutdown
{
  constructor(config: AppConfig) {
    super({ adapter: new PrismaPg({ connectionString: config.databaseUrl }) });
  }

  /** Opens the PostgreSQL connection while the Nest module starts. */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /** Runs a minimal query used by readiness checks. */
  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }

  /** Closes database connections during graceful shutdown. */
  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}
