import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppConfig } from '../../configuration/app-config';

/** Enforces exact configured browser origins before protected authentication work. */
@Injectable()
export class TrustedOriginGuard implements CanActivate {
  constructor(private readonly config: AppConfig) {}

  /**
   * Denies missing or non-allow-listed origins with a stable 403 response and
   * marks the response private. Route admission must run this before session or
   * password processing.
   */
  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    response.setHeader('cache-control', 'no-store');
    response.setHeader('pragma', 'no-cache');
    const origin = request.header('origin');

    if (!origin || !this.config.allowedOrigins.has(origin)) {
      throw new HttpException(
        {
          code: 'ORIGIN_NOT_ALLOWED',
          message: 'Request origin is not allowed.',
          retryable: false,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
