import { AsyncLocalStorage } from 'node:async_hooks';

/** Trusted tracing values available throughout one asynchronous request. */
export type RequestContext = Readonly<{
  requestId: string;
  correlationId: string;
  traceparent?: string;
}>;

const storage = new AsyncLocalStorage<RequestContext>();

/** Runs one operation with tracing values available to its asynchronous calls. */
export function runWithRequestContext<T>(
  context: RequestContext,
  operation: () => T,
): T {
  return storage.run(context, operation);
}

/** Returns tracing values for the active request, or `undefined` outside one. */
export function currentRequestContext(): RequestContext | undefined {
  return storage.getStore();
}
