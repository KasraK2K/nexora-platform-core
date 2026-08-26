import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthenticationUnavailableError } from '../errors/authentication.errors';
import type { RateLimitDecision } from '../rate-limit/authentication-rate-limiter';
import { AuthenticationRateLimiter } from '../rate-limit/redis-authentication-rate-limiter';
import { readNormalizedEmail } from '../dto/request-email.dto';

/** Applies login throttling before password authentication work. */
@Injectable()
export class LoginRequestGuard implements CanActivate {
  constructor(private readonly rateLimiter: AuthenticationRateLimiter) {}

  /** Returns true when allowed, otherwise emits a stable 429 or availability error. */
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
