import { APPLICATION_ERROR_CODES } from './application-error';

const SAFE_ERROR_CODES = new Set<string>([
  ...APPLICATION_ERROR_CODES,
  'P2002',
  'P2034',
]);

/** Returns only an explicitly approved non-sensitive code from a failure. */
export function readSafeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  return typeof error.code === 'string' && SAFE_ERROR_CODES.has(error.code)
    ? error.code
    : undefined;
}
