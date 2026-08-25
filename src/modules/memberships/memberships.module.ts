import { Module } from '@nestjs/common';
import { MEMBERSHIPS_REPOSITORY } from './repositories/memberships.repository';
import { PrismaMembershipsRepository } from './infrastructure/prisma-memberships.repository';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { SessionStateModule } from '../authentication/session-state/session-state.module';
import { AuditModule } from '../audit/audit.module';
import { AuthorizationPolicyModule } from '../authorization/policy/authorization-policy.module';
import { IdentityModule } from '../identity/identity.module';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { Clock } from '../../common/application/clock';
import { IdentifierFactory } from '../../common/application/identifier-factory';
import { MembershipInvitationDelivery } from './application/membership-invitation-delivery';
import { MEMBERSHIP_INVITATION_RATE_LIMITER } from './application/membership-invitation-rate-limiter.port';
import { MembershipInvitationTokenService } from './application/membership-invitation-token.service';
import { MEMBERSHIP_INVITATIONS_REPOSITORY } from './repositories/membership-invitations.repository';
import { PrismaMembershipInvitationsRepository } from './infrastructure/prisma-membership-invitations.repository';
import { MembershipInvitationRateLimiter } from './infrastructure/membership-invitation-rate-limiter';
import { MembershipInvitationsController } from './controllers/membership-invitations.controller';
import { MembershipsController } from './controllers/memberships.controller';
import {
  MembershipInvitationAcceptRequestGuard,
  MembershipInvitationCreateRequestGuard,
} from './guards/membership-invitation-request.guard';
import { MEMBERSHIP_ADMINISTRATION_REPOSITORY } from './repositories/membership-administration.repository';
import { MEMBERSHIP_OWNERSHIP_TRANSFER_RATE_LIMITER } from './application/membership-ownership-transfer-rate-limiter.port';
import { MembershipOwnershipTransferRateLimiter } from './infrastructure/membership-ownership-transfer-rate-limiter';
import { MembershipOwnershipTransferRequestGuard } from './guards/membership-ownership-transfer-request.guard';
import { MembershipInvitationsService } from './membership-invitations.service';
import { MembershipsService } from './memberships.service';

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
  controllers: [MembershipInvitationsController, MembershipsController],
  providers: [
    Clock,
    IdentifierFactory,
    MembershipInvitationTokenService,
    MembershipInvitationDelivery,
    MembershipInvitationCreateRequestGuard,
    MembershipInvitationAcceptRequestGuard,
    MembershipsService,
    MembershipInvitationsService,
    PrismaMembershipsRepository,
    PrismaMembershipInvitationsRepository,
    MembershipInvitationRateLimiter,
    MembershipOwnershipTransferRateLimiter,
    MembershipOwnershipTransferRequestGuard,
    {
      provide: MEMBERSHIPS_REPOSITORY,
      useExisting: PrismaMembershipsRepository,
    },
    {
      provide: MEMBERSHIP_ADMINISTRATION_REPOSITORY,
      useExisting: PrismaMembershipsRepository,
    },
    {
      provide: MEMBERSHIP_INVITATIONS_REPOSITORY,
      useExisting: PrismaMembershipInvitationsRepository,
    },
    {
      provide: MEMBERSHIP_INVITATION_RATE_LIMITER,
      useExisting: MembershipInvitationRateLimiter,
    },
    {
      provide: MEMBERSHIP_OWNERSHIP_TRANSFER_RATE_LIMITER,
      useExisting: MembershipOwnershipTransferRateLimiter,
    },
  ],
  exports: [MembershipsService, MembershipInvitationsService],
})
export class MembershipsModule {}
