import { Module } from '@nestjs/common';
import { MembershipsRepository } from './repositories/memberships.repository';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { SessionStateModule } from '../authentication/session-state/session-state.module';
import { AuditModule } from '../audit/audit.module';
import { AuthorizationPolicyModule } from '../authorization/policy/authorization-policy.module';
import { IdentityModule } from '../identity/identity.module';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { Clock } from '../../common/clock';
import { IdentifierFactory } from '../../common/identifier-factory';
import { MembershipInvitationDeliveryService } from './mail/membership-invitation-delivery.service';
import { OpaqueTokenService } from '../../common/security/opaque-token.service';
import { MembershipInvitationsRepository } from './repositories/membership-invitations.repository';
import { MembershipInvitationRateLimiter } from './rate-limit/redis-membership-invitation-rate-limiter';
import { MembershipInvitationsController } from './controllers/membership-invitations.controller';
import { MembershipsController } from './controllers/memberships.controller';
import {
  MembershipInvitationAcceptRequestGuard,
  MembershipInvitationCreateRequestGuard,
} from './guards/membership-invitation-request.guard';
import { MembershipOwnershipTransferRateLimiter } from './rate-limit/redis-membership-ownership-transfer-rate-limiter';
import { MembershipOwnershipTransferRequestGuard } from './guards/membership-ownership-transfer-request.guard';
import { MembershipInvitationsService } from './membership-invitations.service';
import { MembershipAdministrationService } from './membership-administration.service';
import { MembershipsService } from './memberships.service';
import { MembershipAdministrationController } from './controllers/membership-administration.controller';

/**
 * Composes product-neutral membership, invitation, administration, rate-limit,
 * persistence, and HTTP adapters. Only the two focused application services are public.
 */
@Module({
  imports: [
    InfrastructureModule,
    SessionStateModule,
    AuditModule,
    AuthorizationPolicyModule,
    IdentityModule,
    MailModule,
    UsersModule,
  ],
  controllers: [
    MembershipInvitationsController,
    MembershipsController,
    MembershipAdministrationController,
  ],
  providers: [
    Clock,
    IdentifierFactory,
    OpaqueTokenService,
    MembershipInvitationDeliveryService,
    MembershipInvitationCreateRequestGuard,
    MembershipInvitationAcceptRequestGuard,
    MembershipsService,
    MembershipAdministrationService,
    MembershipInvitationsService,
    MembershipsRepository,
    MembershipInvitationsRepository,
    MembershipInvitationRateLimiter,
    MembershipOwnershipTransferRateLimiter,
    MembershipOwnershipTransferRequestGuard,
  ],
  exports: [MembershipsService],
})
export class MembershipsModule {}
