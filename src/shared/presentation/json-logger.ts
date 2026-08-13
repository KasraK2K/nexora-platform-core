import type { LoggerService } from '@nestjs/common';

const REDACTED = '[REDACTED]';
const SENSITIVE_KEY = /password|secret|token|authorization|cookie|credential/i;

export class JsonLogger implements LoggerService {
  log(message: unknown, context?: string): void {
    this.write('log', message, context);
  }
  error(message: unknown, _stack?: string, context?: string): void {
    this.write('error', message, context);
  }
  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }
  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }
  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }
  fatal(message: unknown, context?: string): void {
    this.write('fatal', message, context);
  }
  setLogLevels(): void {}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
