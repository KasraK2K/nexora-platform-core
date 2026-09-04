import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppConfig } from '../../../config/app-config';
import { SessionContextService } from '../services/session-context.service';
import { attachAuthenticatedRequestContext } from '../decorators/authenticated-request-context.decorator';
import { setPrivateResponseHeaders } from '../../../common/http/private-response-headers';
import { readCookie } from '../../../common/http/session-cookie';

/** Resolves the opaque cookie into immutable server-authoritative request context. */
@Injectable()
export class AuthenticatedRequestContextGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionContextService,
    private readonly config: AppConfig,
  ) {}

  /**
   * Revalidates durable session and tenant state, attaches it to the request,
   * and fails closed through the use case when authority is absent or unavailable.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    setPrivateResponseHeaders(response);
    const authenticated = await this.sessions.resolveAuthenticatedRequest(
      readCookie(request.header('cookie'), this.config.sessionCookieName),
    );

    attachAuthenticatedRequestContext(request, authenticated);
    return true;
  }
}
