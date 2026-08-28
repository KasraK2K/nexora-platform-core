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
      errorType: error instanceof Error ? error.name : 'UnknownError',
      ...(options.includeErrorCode === false
        ? {}
        : { errorCode: readSafeErrorCode(error) }),
    }),
  );
}
