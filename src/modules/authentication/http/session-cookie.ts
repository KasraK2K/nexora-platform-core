import type { Response } from 'express';
import type { AppConfig } from '../../../config/app-config';

/** Parses and decodes one named cookie, returning no value for malformed input. */
export function readCookie(
  header: string | undefined,
  name: string,
): string | undefined {
  if (!header) {
    return undefined;
  }

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) {
      continue;
    }

    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }

  return undefined;
}

/** Writes the opaque secret with browser-only access and configured CSRF policy. */
export function setSessionCookie(
  response: Response,
  config: AppConfig,
  token: string,
  expires: Date,
): void {
  response.cookie(config.sessionCookieName, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    path: '/',
    expires,
  });
}
