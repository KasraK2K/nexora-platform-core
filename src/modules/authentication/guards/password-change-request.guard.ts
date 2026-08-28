import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import {
  enforceRequestRateLimit,
  readClientIp,
} from '../../../common/http/request-rate-limit';
import { AppConfig } from '../../../config/app-config';
import { AuthenticationRateLimiter } from '../rate-limit/redis-authentication-rate-limiter';
import { PasswordChangeUnavailableError } from '../errors/authentication.errors';
import { readCookie } from '../http/session-cookie';

/** Throttles password changes by pseudonymous IP and opaque-session buckets. */
@Injectable()
export class PasswordChangeRequestGuard implements CanActivate {
  constructor(
    private readonly rateLimiter: AuthenticationRateLimiter,
    private readonly config: AppConfig,
  ) {}

  /** Returns true when allowed; limiter failures map to a safe availability error. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    return enforceRequestRateLimit({
      context,
      check: (request) =>
        this.rateLimiter.checkPasswordChange(
          readClientIp(request),
          readCookie(request.header('cookie'), this.config.sessionCookieName),
        ),
      unavailableError: () => new PasswordChangeUnavailableError(),
      denial: {
        code: 'PASSWORD_CHANGE_RATE_LIMITED',
        message: 'Too many password change attempts.',
      },
    });
  }
}
