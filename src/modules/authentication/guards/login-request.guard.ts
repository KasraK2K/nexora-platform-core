import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import {
  enforceRequestRateLimit,
  readClientIp,
} from '../../../common/http/request-rate-limit';
import { AuthenticationUnavailableError } from '../errors/authentication.errors';
import { AuthenticationRateLimiter } from '../rate-limit/redis-authentication-rate-limiter';
import { readNormalizedEmail } from '../dto/request-email.dto';

/** Applies login throttling before password authentication work. */
@Injectable()
export class LoginRequestGuard implements CanActivate {
  constructor(private readonly rateLimiter: AuthenticationRateLimiter) {}

  /** Returns true when allowed, otherwise emits a stable 429 or availability error. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    return enforceRequestRateLimit({
      context,
      check: (request) =>
        this.rateLimiter.checkLogin(
          readClientIp(request),
          readNormalizedEmail(request.body),
        ),
      unavailableError: () => new AuthenticationUnavailableError(),
      denial: {
        code: 'AUTHENTICATION_RATE_LIMITED',
        message: 'Too many authentication attempts.',
      },
    });
  }
}
