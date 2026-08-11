export class TransactionWriteConflictError extends Error {
  readonly code = 'TRANSACTION_WRITE_CONFLICT';
}

export function isTransactionWriteConflict(error: unknown): boolean {
  if (error instanceof TransactionWriteConflictError) return true;
  if (!isUnknownRecord(error)) return false;
  if (error.code === 'P2034') return true;
  return (
    isUnknownRecord(error.cause) &&
    error.cause.kind === 'TransactionWriteConflict'
  );
}

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
