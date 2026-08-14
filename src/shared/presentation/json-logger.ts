import type { LoggerService } from '@nestjs/common';

const REDACTED = '[REDACTED]';
const SENSITIVE_KEY = /password|secret|token|authorization|cookie|credential/i;

/**
 * Writes one JSON object per log entry and removes common secret-bearing fields
 * before anything reaches standard output or standard error.
 *
 * Callers must still avoid logging personal or sensitive content: redaction is
 * based on field names and credential-shaped URLs, not a complete PII scanner.
 */
export class JsonLogger implements LoggerService {
  /** Writes an informational log entry. */
  log(message: unknown, context?: string): void {
    this.write('log', message, context);
  }
  /** Writes an error entry to standard error. Stack text is not logged. */
  error(message: unknown, _stack?: string, context?: string): void {
    this.write('error', message, context);
  }
  /** Writes a warning log entry. */
  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }
  /** Writes a debug log entry. */
  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }
  /** Writes a verbose log entry. */
  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }
  /** Writes a fatal entry to standard error. */
  fatal(message: unknown, context?: string): void {
    this.write('fatal', message, context);
  }
  /** Keeps Nest's default level selection because this logger enables all levels. */
  setLogLevels(): void {}

  /** Normalizes, redacts, serializes, and routes one complete log record. */
  private write(level: string, message: unknown, context?: string): void {
    const output = JSON.stringify(
      redact({
        timestamp: new Date().toISOString(),
        level,
        ...(context ? { context } : {}),
        ...normalizeMessage(message),
      }),
    );
    if (level === 'error' || level === 'fatal')
      process.stderr.write(`${output}\n`);
    else process.stdout.write(`${output}\n`);
  }
}

/** Converts Nest logger input into fields that can be merged into a JSON log. */
function normalizeMessage(message: unknown): Record<string, unknown> {
  if (typeof message === 'string') {
    try {
      const parsed: unknown = JSON.parse(message);
      if (isRecord(parsed)) return parsed;
    } catch {
      return { message };
    }
    return { message };
  }
  return isRecord(message) ? message : { message: String(message) };
}

/** Recursively hides sensitive keys and credentials embedded in URL strings. */
function redact(value: unknown, key = ''): unknown {
  if (SENSITIVE_KEY.test(key)) return REDACTED;
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([nestedKey, nestedValue]) => [
        nestedKey,
        redact(nestedValue, nestedKey),
      ]),
    );
  }
  if (typeof value === 'string') {
    return value.replace(/:\/\/[^\s:@/]+:[^\s@/]+@/g, '://[REDACTED]@');
  }
  return value;
}

/** Narrows an unknown value before its properties are inspected or copied. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
