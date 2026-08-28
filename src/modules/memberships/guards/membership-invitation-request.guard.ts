import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import {
  enforceRequestRateLimit,
  readClientIp,
} from '../../../common/http/request-rate-limit';
import { normalizeUserEmail } from '../../users/users.service';
import { readAuthenticatedRequestContext } from '../../authentication/decorators/authenticated-request-context.decorator';
import { MembershipInvitationRateLimiter } from '../rate-limit/redis-membership-invitation-rate-limiter';
import { MembershipInvitationUnavailableError } from '../errors/membership-invitation.errors';

/** Fails closed while rate-limiting invitation creation from trusted context. */
@Injectable()
export class MembershipInvitationCreateRequestGuard implements CanActivate {
  constructor(private readonly rateLimiter: MembershipInvitationRateLimiter) {}

  /** Checks client, actor, workspace, and normalized target buckets before writes. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    return enforceRequestRateLimit({
      context,
      check: (request) => {
        const authenticated = readAuthenticatedRequestContext(request);
        if (!authenticated) throw new MembershipInvitationUnavailableError();
        return this.rateLimiter.checkCreate({
          clientIp: readClientIp(request),
          actorUserId: authenticated.context.actorUserId,
          workspaceId: authenticated.context.workspaceId,
          normalizedEmail: readNormalizedEmail(request.body),
        });
      },
      unavailableError: () => new MembershipInvitationUnavailableError(),
      denial: {
        code: 'MEMBERSHIP_INVITATION_RATE_LIMITED',
        message: 'Too many membership invitation create attempts.',
      },
    });
  }
}

/** Fails closed while rate-limiting invitation acceptance by active session. */
@Injectable()
export class MembershipInvitationAcceptRequestGuard implements CanActivate {
  constructor(private readonly rateLimiter: MembershipInvitationRateLimiter) {}

  /** Checks client and authenticated-session buckets before token processing. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    return enforceRequestRateLimit({
      context,
      check: (request) => {
        const authenticated = readAuthenticatedRequestContext(request);
        if (!authenticated) throw new MembershipInvitationUnavailableError();
        return this.rateLimiter.checkAccept({
          clientIp: readClientIp(request),
          sessionId: authenticated.context.sessionId,
        });
      },
      unavailableError: () => new MembershipInvitationUnavailableError(),
      denial: {
        code: 'MEMBERSHIP_INVITATION_RATE_LIMITED',
        message: 'Too many membership invitation accept attempts.',
      },
    });
  }
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
