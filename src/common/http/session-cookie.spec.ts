import type { CookieOptions, Response } from 'express';
import type { AppConfig } from '../../config/app-config';
import {
  clearSessionCookie,
  readCookie,
  setSessionCookie,
} from './session-cookie';

describe('session cookie helpers', () => {
  const expires = new Date('2030-01-02T03:04:05.000Z');

  it.each([
    ['secure', true, 'strict' as const, '__Host-nexora_session'],
    ['non-secure', false, 'lax' as const, 'nexora_session'],
  ])(
    'uses matching issue and clear attributes for %s configuration',
    (_label, secure, sameSite, sessionCookieName) => {
      const calls: Array<[string, string, CookieOptions]> = [];
      const cookie = jest.fn(
        (name: string, value: string, options: CookieOptions) => {
          calls.push([name, value, options]);
        },
      );
      const response = { cookie } as unknown as Response;
      const config = {
        cookieSecure: secure,
        cookieSameSite: sameSite,
        sessionCookieName,
      } as AppConfig;

      setSessionCookie(response, config, 'opaque-token', expires);
      clearSessionCookie(response, config);

      const issuedOptions = calls[0]?.[2];
      const clearedOptions = calls[1]?.[2];
      expect(calls[0]?.slice(0, 2)).toEqual([
        sessionCookieName,
        'opaque-token',
      ]);
      expect(calls[1]?.slice(0, 2)).toEqual([sessionCookieName, '']);
      expect(issuedOptions).toEqual({
        httpOnly: true,
        secure,
        sameSite,
        path: '/',
        expires,
      });
      expect(clearedOptions).toEqual({
        httpOnly: true,
        secure,
        sameSite,
        path: '/',
        expires: new Date(0),
        maxAge: 0,
      });
    },
  );

  it('reads encoded cookies and rejects malformed encoding', () => {
    expect(readCookie('one=1; session=a%20b', 'session')).toBe('a b');
    expect(readCookie('session=%E0%A4%A', 'session')).toBeUndefined();
    expect(readCookie(undefined, 'session')).toBeUndefined();
  });
});
