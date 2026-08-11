import { Injectable } from '@nestjs/common';
import type { TransactionManager } from '../../shared/application/transaction-manager.port';
import {
  isTransactionWriteConflict,
  TransactionWriteConflictError,
} from '../../shared/application/transaction-write-conflict';
import { DatabaseContext } from './database-context';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaTransactionManager implements TransactionManager {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: DatabaseContext,
  ) {}

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
