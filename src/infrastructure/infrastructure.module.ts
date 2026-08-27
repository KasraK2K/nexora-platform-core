import { Module } from '@nestjs/common';
import { TRANSACTION_MANAGER } from '../common/transaction-manager';
import { AppConfig } from '../config/app-config';
import { DatabaseContext } from './database/database-context';
import { PrismaService } from './database/prisma.service';
import { PrismaTransactionManager } from './database/prisma-transaction-manager';
import { RedisService } from './cache/redis.service';
import { RedisFixedWindowRateLimiter } from './cache/redis-fixed-window-rate-limiter';

/**
 * Wires configuration, PostgreSQL, Redis, transactions, and security policy for
 * other Core modules. These exports are internal application infrastructure,
 * not public contracts for downstream product modules.
 */
@Module({
  providers: [
    AppConfig,
    PrismaService,
    DatabaseContext,
    PrismaTransactionManager,
    RedisService,
    RedisFixedWindowRateLimiter,
    { provide: TRANSACTION_MANAGER, useExisting: PrismaTransactionManager },
  ],
  exports: [
    AppConfig,
    PrismaService,
    DatabaseContext,
    RedisService,
    RedisFixedWindowRateLimiter,
    TRANSACTION_MANAGER,
  ],
})
export class InfrastructureModule {}
