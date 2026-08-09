import type { Response } from 'express';

export function setPrivateResponseHeaders(response: Response): void {
  response.setHeader('cache-control', 'no-store');
  response.setHeader('pragma', 'no-cache');
}
