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

@Injectable()
export class PasswordResetConfirmationGuard implements CanActivate {
  constructor(
    @Inject(AUTHENTICATION_RATE_LIMITER)
    private readonly rateLimiter: AuthenticationRateLimitPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    try {
      const decision = await this.rateLimiter.checkPasswordResetConfirmation(
        request.ip || request.socket.remoteAddress || 'unknown',
      );
      if (!decision.allowed) {
        response.setHeader(
          'retry-after',
          decision.retryAfterSeconds.toString(),
        );
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
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new PasswordResetUnavailableError();
    }
  }
}
