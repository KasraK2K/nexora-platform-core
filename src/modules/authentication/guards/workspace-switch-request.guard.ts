import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import {
  enforceRequestRateLimit,
  readClientIp,
} from '../../../common/http/request-rate-limit';
import { AppConfig } from '../../../config/app-config';
import { AuthenticationRateLimiter } from '../rate-limit/redis-authentication-rate-limiter';
import { WorkspaceSwitchUnavailableError } from '../errors/authentication.errors';
import { readCookie } from '../../../common/http/session-cookie';

/** Throttles workspace switches by pseudonymous IP and opaque-session buckets. */
@Injectable()
export class WorkspaceSwitchRequestGuard implements CanActivate {
  constructor(
    private readonly rateLimiter: AuthenticationRateLimiter,
    private readonly config: AppConfig,
  ) {}

  /** Returns true when allowed; limiter failures map to a safe availability error. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    return enforceRequestRateLimit({
      context,
      check: (request) =>
        this.rateLimiter.checkWorkspaceSwitch(
          readClientIp(request),
          readCookie(request.header('cookie'), this.config.sessionCookieName),
        ),
      unavailableError: () => new WorkspaceSwitchUnavailableError(),
      denial: {
        code: 'WORKSPACE_SWITCH_RATE_LIMITED',
        message: 'Too many workspace switch attempts.',
      },
    });
  }
}
