import type { NextFunction, Request, Response } from 'express';
import { SecurityHeadersMiddleware } from './security-headers.middleware';

describe('SecurityHeadersMiddleware', () => {
  it('sets transport and content policy headers in production', () => {
    const headers = new Map<string, string>();
    const response = {
      setHeader: (name: string, value: string) => headers.set(name, value),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    new SecurityHeadersMiddleware({ isProduction: true }).use(
      {} as Request,
      response,
      next,
    );

    expect(headers.get('strict-transport-security')).toBe('max-age=31536000');
    expect(headers.get('content-security-policy')).toContain(
      "default-src 'none'",
    );
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not advertise HSTS outside production', () => {
    const headers = new Map<string, string>();
    const response = {
      setHeader: (name: string, value: string) => headers.set(name, value),
    } as unknown as Response;

    new SecurityHeadersMiddleware({ isProduction: false }).use(
      {} as Request,
      response,
      jest.fn(),
    );

    expect(headers.has('strict-transport-security')).toBe(false);
  });
});
