import { logSafeFailure } from './log-safe-failure';

describe('logSafeFailure', () => {
  it('emits only the safe event, error type, and approved code data', () => {
    const error = Object.assign(new Error('contains a secret token'), {
      code: 'AUTHENTICATION_INVALID',
      token: 'secret',
      sql: 'select * from users',
      request: { password: 'password' },
    });
    const messages: string[] = [];
    const logger = {
      error: (message: unknown) => {
        if (typeof message === 'string') messages.push(message);
      },
    };

    logSafeFailure(logger, 'authentication.failed', error);

    expect(messages).toHaveLength(1);
    expect(JSON.parse(messages[0] ?? '')).toEqual({
      event: 'authentication.failed',
      errorType: 'Error',
      errorCode: 'AUTHENTICATION_INVALID',
    });
  });

  it('does not invent error data for an unknown failure', () => {
    const messages: string[] = [];
    const logger = {
      error: (message: unknown) => {
        if (typeof message === 'string') messages.push(message);
      },
    };
    logSafeFailure(logger, 'workflow.failed', 'raw secret');
    expect(JSON.parse(messages[0] ?? '')).toEqual({
      event: 'workflow.failed',
      errorType: 'UnknownError',
    });
  });

  it('omits the code when the caller disables it', () => {
    const messages: string[] = [];
    const logger = {
      error: (message: unknown) => {
        if (typeof message === 'string') messages.push(message);
      },
    };
    logSafeFailure(
      logger,
      'workflow.failed',
      { code: 'AUTHENTICATION_INVALID' },
      { includeErrorCode: false },
    );
    expect(JSON.parse(messages[0] ?? '')).toEqual({
      event: 'workflow.failed',
      errorType: 'UnknownError',
    });
  });

  it('omits arbitrary codes and coarsens mutable error names', () => {
    const messages: string[] = [];
    const logger = {
      error: (message: unknown) => {
        if (typeof message === 'string') messages.push(message);
      },
    };
    const error = Object.assign(new Error('secret'), {
      name: 'SecretTokenError',
      code: 'provider-secret-or-attacker-data',
    });

    logSafeFailure(logger, 'workflow.failed', error);

    expect(JSON.parse(messages[0] ?? '')).toEqual({
      event: 'workflow.failed',
      errorType: 'Error',
    });
  });

  it('retains explicitly approved infrastructure codes', () => {
    const messages: string[] = [];
    const logger = {
      error: (message: unknown) => {
        if (typeof message === 'string') messages.push(message);
      },
    };

    logSafeFailure(logger, 'workflow.failed', { code: 'P2034' });

    expect(JSON.parse(messages[0] ?? '')).toEqual({
      event: 'workflow.failed',
      errorType: 'UnknownError',
      errorCode: 'P2034',
    });
  });
});
