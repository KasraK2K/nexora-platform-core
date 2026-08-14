/** Injection token for the application-wide transaction boundary. */
export const TRANSACTION_MANAGER = Symbol('TRANSACTION_MANAGER');

/**
 * Runs one application-owned unit of database work atomically. Implementations
 * expose the active database client to owning repositories and normalize known
 * write conflicts without leaking ORM types through this port.
 *
 * Only database work enlisted through that client can roll back. Callers must
 * use an outbox or a post-commit step for Redis, mail, logging, and other
 * external side effects.
 */
export interface TransactionManager {
  /** Commits all enlisted database writes or rejects without committing them. */
  execute<T>(operation: () => Promise<T>): Promise<T>;
}
