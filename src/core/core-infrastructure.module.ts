import { Module } from '@nestjs/common';
import { TRANSACTION_MANAGER } from '../shared/application/transaction-manager.port';
import { AppConfig } from './configuration/app-config';
import { DatabaseContext } from './persistence/database-context';
import { PrismaService } from './persistence/prisma.service';
import { PrismaTransactionManager } from './persistence/prisma-transaction-manager';
import { RedisService } from './redis/redis.service';

@Module({
  providers: [
    AppConfig,
    PrismaService,
    DatabaseContext,
    PrismaTransactionManager,
    RedisService,
    { provide: TRANSACTION_MANAGER, useExisting: PrismaTransactionManager },
  ],
  exports: [
    AppConfig,
    PrismaService,
    DatabaseContext,
    RedisService,
    TRANSACTION_MANAGER,
  ],
})
export class CoreInfrastructureModule {}
