import type { Response } from 'express';

/**
 * Expires the session cookie using the same security attributes and root path
 * used when it was created, so browsers reliably discard it.
 */
export function clearSessionCookie(
  response: Response,
  name: string,
  secure: boolean,
  sameSite: 'strict' | 'lax' | 'none',
): void {
  response.cookie(name, '', {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    expires: new Date(0),
    maxAge: 0,
  });
}
