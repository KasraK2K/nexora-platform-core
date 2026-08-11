import {
  isTransactionWriteConflict,
  TransactionWriteConflictError,
} from './transaction-write-conflict';

describe('isTransactionWriteConflict', () => {
  it.each([
    { code: 'P2034' },
    {
      name: 'DriverAdapterError',
      cause: { kind: 'TransactionWriteConflict' },
    },
    new TransactionWriteConflictError(),
  ])('recognizes Prisma transaction conflicts', (error) => {
    expect(isTransactionWriteConflict(error)).toBe(true);
  });

  it('rejects unrelated and malformed errors', () => {
    expect(isTransactionWriteConflict(new Error('unavailable'))).toBe(false);
    expect(isTransactionWriteConflict({ cause: null })).toBe(false);
    expect(isTransactionWriteConflict(null)).toBe(false);
  });
});
