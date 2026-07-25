export const TRANSACTION_MANAGER = Symbol('TRANSACTION_MANAGER');

export interface TransactionManager {
  execute<T>(operation: () => Promise<T>): Promise<T>;
}
