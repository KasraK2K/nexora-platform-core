import type { Response } from 'express';

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
