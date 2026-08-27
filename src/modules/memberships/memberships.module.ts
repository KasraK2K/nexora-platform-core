import { Module } from '@nestjs/common';
import { MembershipsRepository } from './memberships.repository';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { SessionsModule } from '../sessions/sessions.module';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { Clock } from '../../common/clock';
import { IdentifierFactory } from '../../common/identifier-factory';
import { MembershipInvitationDeliveryService } from './mail/membership-invitation-delivery.service';
import { OpaqueTokenService } from '../../common/security/opaque-token.service';
import { MembershipInvitationsRepository } from './membership-invitations.repository';
import { MembershipInvitationRateLimiter } from './rate-limit/redis-membership-invitation-rate-limiter';
import { MembershipInvitationsController } from './membership-invitations.controller';
import { MembershipsController } from './memberships.controller';
import {
  MembershipInvitationAcceptRequestGuard,
  MembershipInvitationCreateRequestGuard,
} from './guards/membership-invitation-request.guard';
import { MembershipInvitationsService } from './membership-invitations.service';
import { MembershipsService } from './memberships.service';

/**
 * Composes membership and invitation controllers, services, repositories, and
 * rate limits. Only the focused membership service is public to other modules.
 */
@Module({
  imports: [
    InfrastructureModule,
    SessionsModule,
    AuditModule,
    MailModule,
    UsersModule,
  ],
  controllers: [MembershipInvitationsController, MembershipsController],
  providers: [
    Clock,
    IdentifierFactory,
    OpaqueTokenService,
    MembershipInvitationDeliveryService,
    MembershipInvitationCreateRequestGuard,
    MembershipInvitationAcceptRequestGuard,
    MembershipsService,
    MembershipInvitationsService,
    MembershipsRepository,
    MembershipInvitationsRepository,
    MembershipInvitationRateLimiter,
  ],
  exports: [MembershipsService],
})
export class MembershipsModule {}
