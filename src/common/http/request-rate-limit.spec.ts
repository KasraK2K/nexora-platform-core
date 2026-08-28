import { HttpException, type ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';
import { enforceRequestRateLimit, readClientIp } from './request-rate-limit';

describe('request rate-limit HTTP mapping', () => {
  const request = {
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.2' },
  } as Request;
  const setHeader = jest.fn();
  const response = { setHeader } as unknown as Response;
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
  const denial = { code: 'TEST_RATE_LIMITED', message: 'Try later.' };

  beforeEach(() => jest.clearAllMocks());

  it('allows an accepted decision', async () => {
    await expect(
      enforceRequestRateLimit({
        context,
        check: () => Promise.resolve({ allowed: true, retryAfterSeconds: 0 }),
        unavailableError: () => new Error('unavailable'),
        denial,
      }),
    ).resolves.toBe(true);
    expect(setHeader).not.toHaveBeenCalled();
  });

  it('maps a denied decision to the stable response and Retry-After', async () => {
    const failure = await enforceRequestRateLimit({
      context,
      check: () => Promise.resolve({ allowed: false, retryAfterSeconds: 7 }),
      unavailableError: () => new Error('unavailable'),
      denial,
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(HttpException);
    expect((failure as HttpException).getStatus()).toBe(429);
    expect((failure as HttpException).getResponse()).toEqual({
      ...denial,
      retryable: true,
    });
    expect(setHeader).toHaveBeenCalledWith('retry-after', '7');
  });

  it('maps limiter failure through the feature error factory', async () => {
    const unavailable = new Error('safe failure');
    await expect(
      enforceRequestRateLimit({
        context,
        check: () => Promise.reject(new Error('redis detail')),
        unavailableError: () => unavailable,
        denial,
      }),
    ).rejects.toBe(unavailable);
  });

  it('uses the request IP before the socket fallback', () => {
    expect(readClientIp(request)).toBe('127.0.0.1');
  });
});
