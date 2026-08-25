/** Signals a concurrent database write that may succeed when retried. */
export class TransactionWriteConflictError extends Error {
  readonly code = 'TRANSACTION_WRITE_CONFLICT';
}

/**
 * Recognizes the shared conflict error, Prisma's serializable-conflict code,
 * and the PostgreSQL adapter's nested conflict marker without leaking those
 * provider-specific shapes to application use cases.
 */
export function isTransactionWriteConflict(error: unknown): boolean {
  if (error instanceof TransactionWriteConflictError) return true;
  if (!isUnknownRecord(error)) return false;
  if (error.code === 'P2034') return true;
  return (
    isUnknownRecord(error.cause) &&
    error.cause.kind === 'TransactionWriteConflict'
  );
}

/** Narrows an unknown caught value before checking adapter error fields. */
function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
