import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import {
  enforceRequestRateLimit,
  readClientIp,
} from '../../../common/http/request-rate-limit';
import { RegistrationUnavailableError } from '../errors/authentication.errors';
import { AuthenticationRateLimiter } from '../rate-limit/redis-authentication-rate-limiter';
import { readNormalizedEmail } from '../dto/request-email.dto';

/** Applies registration throttling before validation, screening, and hashing work. */
@Injectable()
export class RegistrationRequestGuard implements CanActivate {
  constructor(private readonly rateLimiter: AuthenticationRateLimiter) {}

  /** Returns true when allowed, otherwise emits a stable 429 or availability error. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    return enforceRequestRateLimit({
      context,
      check: (request) =>
        this.rateLimiter.checkRegistration(
          readClientIp(request),
          readNormalizedEmail(request.body),
        ),
      unavailableError: () => new RegistrationUnavailableError(),
      denial: {
        code: 'REGISTRATION_RATE_LIMITED',
        message: 'Too many registration attempts.',
      },
    });
  }
}
