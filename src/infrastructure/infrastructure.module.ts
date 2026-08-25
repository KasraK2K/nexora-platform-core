import { Module } from '@nestjs/common';
import { SECURITY_POLICY } from '../common/application/security-policy';
import { TRANSACTION_MANAGER } from '../common/application/transaction-manager.port';
import { AppConfig } from '../config/app-config';
import { DatabaseContext } from './database/database-context';
import { PrismaService } from './database/prisma.service';
import { PrismaTransactionManager } from './database/prisma-transaction-manager';
import { RedisService } from './cache/redis.service';

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
    { provide: TRANSACTION_MANAGER, useExisting: PrismaTransactionManager },
    { provide: SECURITY_POLICY, useExisting: AppConfig },
  ],
  exports: [
    AppConfig,
    PrismaService,
    DatabaseContext,
    RedisService,
    TRANSACTION_MANAGER,
    SECURITY_POLICY,
  ],
})
export class InfrastructureModule {}
