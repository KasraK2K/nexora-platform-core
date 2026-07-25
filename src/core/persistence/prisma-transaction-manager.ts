import { Injectable } from '@nestjs/common';
import type { TransactionManager } from '../../shared/application/transaction-manager.port';
import { DatabaseContext } from './database-context';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaTransactionManager implements TransactionManager {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: DatabaseContext,
  ) {}

  execute<T>(operation: () => Promise<T>): Promise<T> {
    return this.prisma.$transaction(
      (transaction) => this.context.run(transaction, operation),
      { isolationLevel: 'Serializable' },
    );
  }
}
