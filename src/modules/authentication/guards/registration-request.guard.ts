import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { RegistrationUnavailableError } from '../errors/authentication.errors';
import type { RateLimitDecision } from '../rate-limit/authentication-rate-limiter';
import { AuthenticationRateLimiter } from '../rate-limit/redis-authentication-rate-limiter';
import { readNormalizedEmail } from '../dto/request-email.dto';

/** Applies registration throttling before validation, screening, and hashing work. */
@Injectable()
export class RegistrationRequestGuard implements CanActivate {
  constructor(private readonly rateLimiter: AuthenticationRateLimiter) {}

  /** Returns true when allowed, otherwise emits a stable 429 or availability error. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const email = readNormalizedEmail(request.body);
    let decision: RateLimitDecision;
    try {
      decision = await this.rateLimiter.checkRegistration(
        request.ip || request.socket.remoteAddress || 'unknown',
        email,
      );
    } catch {
      throw new RegistrationUnavailableError();
    }

    if (!decision.allowed) {
      response.setHeader('retry-after', decision.retryAfterSeconds.toString());
      throw new HttpException(
        {
          code: 'REGISTRATION_RATE_LIMITED',
          message: 'Too many registration attempts.',
          retryable: true,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
