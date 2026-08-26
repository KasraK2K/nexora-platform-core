import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AppConfig } from '../../config/app-config';

/** Adds conservative browser security headers before a request reaches a route. */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  constructor(private readonly config: AppConfig) {}

  /**
   * Sets headers for every environment and adds CSP and HSTS in production.
   * The middleware always calls `next` after the response headers are ready.
   */
  use(_request: Request, response: Response, next: NextFunction): void {
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('x-frame-options', 'DENY');
    response.setHeader('referrer-policy', 'no-referrer');
    response.setHeader(
      'permissions-policy',
      'camera=(), microphone=(), geolocation=(), payment=()',
    );
    response.setHeader('cross-origin-resource-policy', 'same-origin');
    if (this.config.isProduction) {
      response.setHeader(
        'content-security-policy',
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      );
      response.setHeader('strict-transport-security', 'max-age=31536000');
    }
    next();
  }
}
