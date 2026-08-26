import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthenticationRateLimiter } from '../rate-limit/redis-authentication-rate-limiter';
import { EmailVerificationUnavailableError } from '../errors/authentication.errors';

/** Throttles verification-token confirmation before token lookup. */
@Injectable()
export class EmailVerificationConfirmationGuard implements CanActivate {
  constructor(private readonly rateLimiter: AuthenticationRateLimiter) {}

  /** Returns true when allowed; limiter failures map to a safe availability error. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    let decision;
    try {
      decision = await this.rateLimiter.checkEmailVerificationConfirmation(
        request.ip || request.socket.remoteAddress || 'unknown',
      );
    } catch {
      throw new EmailVerificationUnavailableError();
    }
    if (!decision.allowed) {
      response.setHeader('retry-after', decision.retryAfterSeconds.toString());
      throw new HttpException(
        {
          code: 'EMAIL_VERIFICATION_RATE_LIMITED',
          message: 'Too many email verification attempts.',
          retryable: true,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
