import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { normalizeUserEmail } from '../../users/users.service';
import { readAuthenticatedRequestContext } from '../../authentication/decorators/authenticated-request-context.decorator';
import type { MembershipInvitationRateLimitDecision } from '../rate-limit/membership-invitation-rate-limiter';
import { MembershipInvitationRateLimiter } from '../rate-limit/redis-membership-invitation-rate-limiter';
import { MembershipInvitationUnavailableError } from '../errors/membership-invitation.errors';

/** Fails closed while rate-limiting invitation creation from trusted context. */
@Injectable()
export class MembershipInvitationCreateRequestGuard implements CanActivate {
  constructor(private readonly rateLimiter: MembershipInvitationRateLimiter) {}

  /** Checks client, actor, workspace, and normalized target buckets before writes. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const authenticated = readAuthenticatedRequestContext(request);
    if (!authenticated) throw new MembershipInvitationUnavailableError();

    let decision: MembershipInvitationRateLimitDecision;
    try {
      decision = await this.rateLimiter.checkCreate({
        clientIp: request.ip || request.socket.remoteAddress || 'unknown',
        actorUserId: authenticated.context.actorUserId,
        workspaceId: authenticated.context.workspaceId,
        normalizedEmail: readNormalizedEmail(request.body),
      });
    } catch {
      throw new MembershipInvitationUnavailableError();
    }
    enforceDecision(http.getResponse<Response>(), decision, 'create');
    return true;
  }
}

/** Fails closed while rate-limiting invitation acceptance by active session. */
@Injectable()
export class MembershipInvitationAcceptRequestGuard implements CanActivate {
  constructor(private readonly rateLimiter: MembershipInvitationRateLimiter) {}

  /** Checks client and authenticated-session buckets before token processing. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const authenticated = readAuthenticatedRequestContext(request);
    if (!authenticated) throw new MembershipInvitationUnavailableError();

    let decision: MembershipInvitationRateLimitDecision;
    try {
      decision = await this.rateLimiter.checkAccept({
        clientIp: request.ip || request.socket.remoteAddress || 'unknown',
        sessionId: authenticated.context.sessionId,
      });
    } catch {
      throw new MembershipInvitationUnavailableError();
    }
    enforceDecision(http.getResponse<Response>(), decision, 'accept');
    return true;
  }
}

/** Maps a denied limiter decision to a stable 429 response and Retry-After. */
function enforceDecision(
  response: Response,
  decision: MembershipInvitationRateLimitDecision,
  operation: 'create' | 'accept',
): void {
  if (decision.allowed) return;
  response.setHeader('retry-after', decision.retryAfterSeconds.toString());
  throw new HttpException(
    {
      code: 'MEMBERSHIP_INVITATION_RATE_LIMITED',
      message: `Too many membership invitation ${operation} attempts.`,
      retryable: true,
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

/** Safely extracts and normalizes an optional email from the untrusted body. */
function readNormalizedEmail(body: unknown): string | undefined {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('email' in body) ||
    typeof body.email !== 'string'
  ) {
    return undefined;
  }
  return normalizeUserEmail(body.email);
}
