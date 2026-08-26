import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppConfig } from '../../../config/app-config';
import { AuthenticationRateLimiter } from '../rate-limit/redis-authentication-rate-limiter';
import { PasswordChangeUnavailableError } from '../errors/authentication.errors';
import { readCookie } from '../http/session-cookie';

/** Throttles password changes by pseudonymous IP and opaque-session buckets. */
@Injectable()
export class PasswordChangeRequestGuard implements CanActivate {
  constructor(
    private readonly rateLimiter: AuthenticationRateLimiter,
    private readonly config: AppConfig,
  ) {}

  /** Returns true when allowed; limiter failures map to a safe availability error. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    let decision;
    try {
      decision = await this.rateLimiter.checkPasswordChange(
        request.ip || request.socket.remoteAddress || 'unknown',
        readCookie(request.header('cookie'), this.config.sessionCookieName),
      );
    } catch {
      throw new PasswordChangeUnavailableError();
    }
    if (!decision.allowed) {
      response.setHeader('retry-after', decision.retryAfterSeconds.toString());
      throw new HttpException(
        {
          code: 'PASSWORD_CHANGE_RATE_LIMITED',
          message: 'Too many password change attempts.',
          retryable: true,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
