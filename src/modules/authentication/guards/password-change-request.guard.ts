import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppConfig } from '../../../config/app-config';
import {
  AUTHENTICATION_RATE_LIMITER,
  type AuthenticationRateLimitPort,
} from '../application/authentication-rate-limiter.port';
import { PasswordChangeUnavailableError } from '../domain/registration.errors';
import { readCookie } from '../http/session-cookie';

/** Throttles password changes by pseudonymous IP and opaque-session buckets. */
@Injectable()
export class PasswordChangeRequestGuard implements CanActivate {
  constructor(
    @Inject(AUTHENTICATION_RATE_LIMITER)
    private readonly rateLimiter: AuthenticationRateLimitPort,
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
