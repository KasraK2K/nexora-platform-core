import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppConfig } from '../../../config/app-config';
import { AuthenticationRateLimiter } from '../rate-limit/redis-authentication-rate-limiter';
import { WorkspaceSwitchUnavailableError } from '../errors/authentication.errors';
import { readCookie } from '../http/session-cookie';

/** Throttles workspace switches by pseudonymous IP and opaque-session buckets. */
@Injectable()
export class WorkspaceSwitchRequestGuard implements CanActivate {
  constructor(
    private readonly rateLimiter: AuthenticationRateLimiter,
    private readonly config: AppConfig,
  ) {}

  /** Returns true when allowed; limiter failures map to a safe availability error. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    let decision;
    try {
      decision = await this.rateLimiter.checkWorkspaceSwitch(
        request.ip || request.socket.remoteAddress || 'unknown',
        readCookie(request.header('cookie'), this.config.sessionCookieName),
      );
    } catch {
      throw new WorkspaceSwitchUnavailableError();
    }
    if (!decision.allowed) {
      response.setHeader('retry-after', decision.retryAfterSeconds.toString());
      throw new HttpException(
        {
          code: 'WORKSPACE_SWITCH_RATE_LIMITED',
          message: 'Too many workspace switch attempts.',
          retryable: true,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
