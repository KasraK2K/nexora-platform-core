import { isTransactionWriteConflict } from './transaction-write-conflict';

/** Recognizes a write conflict that is safe to retry once. */
export type WriteConflictPredicate = (error: unknown) => boolean;

/**
 * Repeats one complete transaction operation after its first recognized write
 * conflict. A second failure is returned to the owning feature for safe error
 * mapping and logging.
 */
export async function retryOnceOnWriteConflict<T>(
  operation: () => Promise<T>,
  isWriteConflict: WriteConflictPredicate = isTransactionWriteConflict,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isWriteConflict(error)) throw error;
  }
  return operation();
}
