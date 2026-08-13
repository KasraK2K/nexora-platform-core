import { AsyncLocalStorage } from 'node:async_hooks';

export type RequestContext = Readonly<{
  requestId: string;
  correlationId: string;
  traceparent?: string;
}>;

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(
  context: RequestContext,
  operation: () => T,
): T {
  return storage.run(context, operation);
}

export function currentRequestContext(): RequestContext | undefined {
  return storage.getStore();
}
