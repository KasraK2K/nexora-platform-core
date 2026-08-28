import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import {
  enforceRequestRateLimit,
  readClientIp,
} from '../../../common/http/request-rate-limit';
import { AuthenticationRateLimiter } from '../rate-limit/redis-authentication-rate-limiter';
import { PasswordResetUnavailableError } from '../errors/authentication.errors';
import { readNormalizedEmail } from '../dto/request-email.dto';

/** Throttles password-reset requests without exposing account existence. */
@Injectable()
export class PasswordResetRequestGuard implements CanActivate {
  constructor(private readonly rateLimiter: AuthenticationRateLimiter) {}

  /** Returns true when allowed; limiter failures map to a safe availability error. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    return enforceRequestRateLimit({
      context,
      check: (request) =>
        this.rateLimiter.checkPasswordResetRequest(
          readClientIp(request),
          readNormalizedEmail(request.body),
        ),
      unavailableError: () => new PasswordResetUnavailableError(),
      denial: {
        code: 'PASSWORD_RESET_RATE_LIMITED',
        message: 'Too many password reset attempts.',
      },
    });
  }
}
