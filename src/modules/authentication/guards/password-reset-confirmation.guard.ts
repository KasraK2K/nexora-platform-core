import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import {
  enforceRequestRateLimit,
  readClientIp,
} from '../../../common/http/request-rate-limit';
import { AuthenticationRateLimiter } from '../rate-limit/redis-authentication-rate-limiter';
import { PasswordResetUnavailableError } from '../errors/authentication.errors';

/** Throttles reset-token confirmation before token and password processing. */
@Injectable()
export class PasswordResetConfirmationGuard implements CanActivate {
  constructor(private readonly rateLimiter: AuthenticationRateLimiter) {}

  /** Returns true when allowed; limiter failures map to a safe availability error. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    return enforceRequestRateLimit({
      context,
      check: (request) =>
        this.rateLimiter.checkPasswordResetConfirmation(readClientIp(request)),
      unavailableError: () => new PasswordResetUnavailableError(),
      denial: {
        code: 'PASSWORD_RESET_RATE_LIMITED',
        message: 'Too many password reset attempts.',
      },
    });
  }
}
