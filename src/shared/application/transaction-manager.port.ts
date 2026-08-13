export const TRANSACTION_MANAGER = Symbol('TRANSACTION_MANAGER');

/**
 * Runs one application-owned unit of work atomically. Implementations expose
 * the active database client to owning repositories and normalize known write
 * conflicts without leaking ORM types through this port.
 */
export interface TransactionManager {
  execute<T>(operation: () => Promise<T>): Promise<T>;
}
