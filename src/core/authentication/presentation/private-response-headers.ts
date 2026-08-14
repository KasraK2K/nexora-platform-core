import type { Response } from 'express';

/** Prevents browsers and intermediaries from caching authentication responses. */
export function setPrivateResponseHeaders(response: Response): void {
  response.setHeader('cache-control', 'no-store');
  response.setHeader('pragma', 'no-cache');
}
