import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import {
  SECURITY_POLICY,
  type SecurityPolicy,
} from '../application/security-policy';

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  constructor(
    @Inject(SECURITY_POLICY) private readonly securityPolicy: SecurityPolicy,
  ) {}

  use(_request: Request, response: Response, next: NextFunction): void {
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('x-frame-options', 'DENY');
    response.setHeader('referrer-policy', 'no-referrer');
    response.setHeader(
      'permissions-policy',
      'camera=(), microphone=(), geolocation=(), payment=()',
    );
    response.setHeader('cross-origin-resource-policy', 'same-origin');
    if (this.securityPolicy.isProduction) {
      response.setHeader(
        'content-security-policy',
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      );
      response.setHeader('strict-transport-security', 'max-age=31536000');
    }
    next();
  }
}
