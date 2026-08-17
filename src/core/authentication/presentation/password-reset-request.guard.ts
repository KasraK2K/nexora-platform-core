import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  AUTHENTICATION_RATE_LIMITER,
  type AuthenticationRateLimitPort,
} from '../application/authentication-rate-limiter.port';
import { PasswordResetUnavailableError } from '../domain/registration.errors';
import { readNormalizedEmail } from './request-email';

/** Throttles password-reset requests without exposing account existence. */
@Injectable()
export class PasswordResetRequestGuard implements CanActivate {
  constructor(
    @Inject(AUTHENTICATION_RATE_LIMITER)
    private readonly rateLimiter: AuthenticationRateLimitPort,
  ) {}

  /** Returns true when allowed; limiter failures map to a safe availability error. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    let decision;
    try {
      decision = await this.rateLimiter.checkPasswordResetRequest(
        request.ip || request.socket.remoteAddress || 'unknown',
        readNormalizedEmail(request.body),
      );
    } catch {
      throw new PasswordResetUnavailableError();
    }
    if (!decision.allowed) {
      response.setHeader('retry-after', decision.retryAfterSeconds.toString());
      throw new HttpException(
        {
          code: 'PASSWORD_RESET_RATE_LIMITED',
          message: 'Too many password reset attempts.',
          retryable: true,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
