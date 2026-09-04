import type { LoggerService } from '@nestjs/common';
import { readSafeErrorCode } from '../errors/safe-error-code';

/** Controls the stable fields included in one safe failure entry. */
export type SafeFailureLogOptions = Readonly<{
  includeErrorCode?: boolean;
}>;

/** Writes a redacted workflow failure classification without stack or input data. */
export function logSafeFailure(
  logger: Pick<LoggerService, 'error'>,
  event: string,
  error: unknown,
  options: SafeFailureLogOptions = {},
): void {
  logger.error(
    JSON.stringify({
      event,
      errorType: readSafeErrorType(error),
      ...(options.includeErrorCode === false
        ? {}
        : { errorCode: readSafeErrorCode(error) }),
    }),
  );
}

/** Coarsens mutable Error names to a closed, non-sensitive diagnostic type. */
function readSafeErrorType(error: unknown): string {
  if (!(error instanceof Error)) return 'UnknownError';
  return STANDARD_ERROR_NAMES.has(error.name) ? error.name : 'Error';
}

const STANDARD_ERROR_NAMES = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'URIError',
  'EvalError',
  'AggregateError',
]);
