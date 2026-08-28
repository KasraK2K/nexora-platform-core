import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import {
  enforceRequestRateLimit,
  readClientIp,
} from '../../../common/http/request-rate-limit';
import { AuthenticationRateLimiter } from '../rate-limit/redis-authentication-rate-limiter';
import { EmailVerificationUnavailableError } from '../errors/authentication.errors';

/** Throttles verification-token confirmation before token lookup. */
@Injectable()
export class EmailVerificationConfirmationGuard implements CanActivate {
  constructor(private readonly rateLimiter: AuthenticationRateLimiter) {}

  /** Returns true when allowed; limiter failures map to a safe availability error. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    return enforceRequestRateLimit({
      context,
      check: (request) =>
        this.rateLimiter.checkEmailVerificationConfirmation(
          readClientIp(request),
        ),
      unavailableError: () => new EmailVerificationUnavailableError(),
      denial: {
        code: 'EMAIL_VERIFICATION_RATE_LIMITED',
        message: 'Too many email verification attempts.',
      },
    });
  }
}
