import type { Prisma } from '@prisma/client';
import { TransactionWriteConflictError } from '../../common/application/transaction-write-conflict';
import { DatabaseContext } from './database-context';
import { PrismaService } from './prisma.service';
import { PrismaTransactionManager } from './prisma-transaction-manager';

describe('PrismaTransactionManager', () => {
  it.each([
    Object.assign(new Error('Prisma conflict'), { code: 'P2034' }),
    Object.assign(new Error('Adapter conflict'), {
      name: 'DriverAdapterError',
      cause: { kind: 'TransactionWriteConflict' },
    }),
  ])('translates provider transaction conflicts', async (providerError) => {
    const fixture = createFixture();
    await expect(
      fixture.manager.execute(() => Promise.reject(providerError)),
    ).rejects.toBeInstanceOf(TransactionWriteConflictError);
  });

  it('rethrows unrelated errors unchanged', async () => {
    const fixture = createFixture();
    const domainError = new Error('domain decision');
    await expect(
      fixture.manager.execute(() => Promise.reject(domainError)),
    ).rejects.toBe(domainError);
  });

  it('runs the operation in the database context at Serializable isolation', async () => {
    const fixture = createFixture();
    const operation = jest.fn(() => Promise.resolve('result'));

    await expect(fixture.manager.execute(operation)).resolves.toBe('result');
    expect(fixture.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(fixture.runInContext).toHaveBeenCalledWith(
      fixture.transactionClient,
      operation,
    );
  });
});

function createFixture() {
  const transactionClient = {} as Prisma.TransactionClient;
  const runInContext = jest.fn(
    (_client: Prisma.TransactionClient, operation: () => Promise<unknown>) =>
      operation(),
  );
  const transaction = jest.fn(
    (
      operation: (client: Prisma.TransactionClient) => Promise<unknown>,
      options: { isolationLevel: 'Serializable' },
    ) => {
      void options;
      return operation(transactionClient);
    },
  );
  const manager = new PrismaTransactionManager(
    { $transaction: transaction } as unknown as PrismaService,
    { run: runInContext } as unknown as DatabaseContext,
  );
  return { manager, runInContext, transaction, transactionClient };
}
