import { retryOnceOnWriteConflict } from './transaction-retry';
import { TransactionWriteConflictError } from './transaction-write-conflict';

describe('retryOnceOnWriteConflict', () => {
  it('retries one recognized write conflict', async () => {
    const operation = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(new TransactionWriteConflictError())
      .mockResolvedValueOnce('committed');

    await expect(retryOnceOnWriteConflict(operation)).resolves.toBe(
      'committed',
    );
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('does not retry an unrelated failure', async () => {
    const failure = new Error('unavailable');
    const operation = jest.fn<Promise<void>, []>().mockRejectedValue(failure);

    await expect(retryOnceOnWriteConflict(operation)).rejects.toBe(failure);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('lets a feature recognize its own optimistic conflict', async () => {
    const conflict = new Error('feature conflict');
    const operation = jest
      .fn<Promise<number>, []>()
      .mockRejectedValueOnce(conflict)
      .mockResolvedValueOnce(2);

    await expect(
      retryOnceOnWriteConflict(operation, (error) => error === conflict),
    ).resolves.toBe(2);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('returns the second failure without a third attempt', async () => {
    const secondFailure = new Error('still unavailable');
    const operation = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new TransactionWriteConflictError())
      .mockRejectedValueOnce(secondFailure);

    await expect(retryOnceOnWriteConflict(operation)).rejects.toBe(
      secondFailure,
    );
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
