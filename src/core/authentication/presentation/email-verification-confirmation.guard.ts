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
import { EmailVerificationUnavailableError } from '../domain/registration.errors';

@Injectable()
export class EmailVerificationConfirmationGuard implements CanActivate {
  constructor(
    @Inject(AUTHENTICATION_RATE_LIMITER)
    private readonly rateLimiter: AuthenticationRateLimitPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    try {
      const decision =
        await this.rateLimiter.checkEmailVerificationConfirmation(
          request.ip || request.socket.remoteAddress || 'unknown',
        );
      if (!decision.allowed) {
        response.setHeader(
          'retry-after',
          decision.retryAfterSeconds.toString(),
        );
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
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new EmailVerificationUnavailableError();
    }
  }
}
