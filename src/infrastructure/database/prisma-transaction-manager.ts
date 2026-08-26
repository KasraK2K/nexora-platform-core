import { Injectable } from '@nestjs/common';
import type { TransactionManager } from '../../common/transaction-manager';
import {
  isTransactionWriteConflict,
  TransactionWriteConflictError,
} from '../../common/transaction-write-conflict';
import { DatabaseContext } from './database-context';
import { PrismaService } from './prisma.service';

/**
 * Implements application-owned transactions with Prisma at serializable
 * isolation and exposes their client through `DatabaseContext`.
 */
@Injectable()
export class PrismaTransactionManager implements TransactionManager {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: DatabaseContext,
  ) {}

  /**
   * Commits one operation atomically and normalizes recognized write conflicts.
   * It does not retry automatically; the owning use case decides whether retry
   * is safe for its command.
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(
        (transaction) => this.context.run(transaction, operation),
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (isTransactionWriteConflict(error)) {
        throw new TransactionWriteConflictError();
      }
      throw error;
    }
  }
}
