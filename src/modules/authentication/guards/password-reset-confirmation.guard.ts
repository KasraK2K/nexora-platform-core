import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthenticationRateLimiter } from '../rate-limit/redis-authentication-rate-limiter';
import { PasswordResetUnavailableError } from '../errors/authentication.errors';

/** Throttles reset-token confirmation before token and password processing. */
@Injectable()
export class PasswordResetConfirmationGuard implements CanActivate {
  constructor(private readonly rateLimiter: AuthenticationRateLimiter) {}

  /** Returns true when allowed; limiter failures map to a safe availability error. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    let decision;
    try {
      decision = await this.rateLimiter.checkPasswordResetConfirmation(
        request.ip || request.socket.remoteAddress || 'unknown',
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
