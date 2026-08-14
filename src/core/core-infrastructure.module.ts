import { Module } from '@nestjs/common';
import { SECURITY_POLICY } from '../shared/application/security-policy';
import { TRANSACTION_MANAGER } from '../shared/application/transaction-manager.port';
import { AppConfig } from './configuration/app-config';
import { DatabaseContext } from './persistence/database-context';
import { PrismaService } from './persistence/prisma.service';
import { PrismaTransactionManager } from './persistence/prisma-transaction-manager';
import { RedisService } from './redis/redis.service';

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
export class CoreInfrastructureModule {}
