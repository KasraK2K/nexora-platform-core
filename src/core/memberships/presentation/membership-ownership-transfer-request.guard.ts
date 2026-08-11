import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { readAuthenticatedRequestContext } from '../../authentication/presentation/authenticated-request-context';
import {
  MEMBERSHIP_OWNERSHIP_TRANSFER_RATE_LIMITER,
  type MembershipOwnershipTransferRateLimitDecision,
  type MembershipOwnershipTransferRateLimiterPort,
} from '../application/membership-ownership-transfer-rate-limiter.port';
import { MembershipAdministrationUnavailableError } from '../domain/membership-administration.errors';

@Injectable()
export class MembershipOwnershipTransferRequestGuard implements CanActivate {
  constructor(
    @Inject(MEMBERSHIP_OWNERSHIP_TRANSFER_RATE_LIMITER)
    private readonly rateLimiter: MembershipOwnershipTransferRateLimiterPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const authenticated = readAuthenticatedRequestContext(request);
    if (!authenticated) throw new MembershipAdministrationUnavailableError();

    let decision: MembershipOwnershipTransferRateLimitDecision;
    try {
      decision = await this.rateLimiter.check({
        clientIp: request.ip || request.socket.remoteAddress || 'unknown',
        sessionId: authenticated.context.sessionId,
        workspaceId: authenticated.context.workspaceId,
      });
    } catch {
      throw new MembershipAdministrationUnavailableError();
    }
    if (decision.allowed) return true;

    http
      .getResponse<Response>()
      .setHeader('retry-after', decision.retryAfterSeconds.toString());
    throw new HttpException(
      {
        code: 'MEMBERSHIP_OWNERSHIP_TRANSFER_RATE_LIMITED',
        message: 'Too many workspace ownership transfer attempts.',
        retryable: true,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
