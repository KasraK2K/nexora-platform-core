import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthenticationUnavailableError } from '../domain/registration.errors';
import {
  AUTHENTICATION_RATE_LIMITER,
  type AuthenticationRateLimitPort,
  type RateLimitDecision,
} from '../application/authentication-rate-limiter.port';
import { readNormalizedEmail } from './request-email';

@Injectable()
export class LoginRequestGuard implements CanActivate {
  constructor(
    @Inject(AUTHENTICATION_RATE_LIMITER)
    private readonly rateLimiter: AuthenticationRateLimitPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    let decision: RateLimitDecision;

    try {
      decision = await this.rateLimiter.checkLogin(
        request.ip || request.socket.remoteAddress || 'unknown',
        readNormalizedEmail(request.body),
      );
    } catch {
      throw new AuthenticationUnavailableError();
    }

    if (!decision.allowed) {
      response.setHeader('retry-after', decision.retryAfterSeconds.toString());
      throw new HttpException(
        {
          code: 'AUTHENTICATION_RATE_LIMITED',
          message: 'Too many authentication attempts.',
          retryable: true,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
