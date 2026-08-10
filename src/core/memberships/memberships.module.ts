import { Module } from '@nestjs/common';
import { MEMBERSHIPS_REPOSITORY, Memberships } from './application/memberships';
import { PrismaMembershipsRepository } from './infrastructure/prisma-memberships.repository';
import { CoreInfrastructureModule } from '../core-infrastructure.module';
import { AuditModule } from '../audit/audit.module';
import { AuthorizationPolicyModule } from '../authorization/authorization-policy.module';
import { IdentityModule } from '../identity/identity.module';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { Clock } from '../../shared/application/clock';
import { IdentifierFactory } from '../../shared/application/identifier-factory';
import { AcceptMembershipInvitation } from './application/accept-membership-invitation.use-case';
import { InvitedMembershipsWriter } from './application/invited-memberships-writer';
import { CreateMembershipInvitation } from './application/create-membership-invitation.use-case';
import { RevokeMembershipInvitation } from './application/revoke-membership-invitation.use-case';
import { MembershipInvitationDelivery } from './application/membership-invitation-delivery';
import { MEMBERSHIP_INVITATION_RATE_LIMITER } from './application/membership-invitation-rate-limiter.port';
import { MEMBERSHIP_INVITATION_SENDER } from './application/membership-invitation-sender.port';
import { MembershipInvitationTokenService } from './application/membership-invitation-token.service';
import {
  MEMBERSHIP_INVITATIONS_REPOSITORY,
  MembershipInvitations,
} from './application/membership-invitations';
import { PrismaMembershipInvitationsRepository } from './infrastructure/prisma-membership-invitations.repository';
import { SmtpMembershipInvitationSender } from './infrastructure/smtp-membership-invitation.sender';
import { MembershipInvitationRateLimiter } from './infrastructure/membership-invitation-rate-limiter';
import { MembershipInvitationsController } from './presentation/membership-invitations.controller';
import {
  MembershipInvitationAcceptRequestGuard,
  MembershipInvitationCreateRequestGuard,
} from './presentation/membership-invitation-request.guard';

@Module({
  imports: [
    CoreInfrastructureModule,
    AuditModule,
    AuthorizationPolicyModule,
    IdentityModule,
    MailModule,
    UsersModule,
  ],
  controllers: [MembershipInvitationsController],
  providers: [
    Clock,
    IdentifierFactory,
    Memberships,
    InvitedMembershipsWriter,
    MembershipInvitations,
    MembershipInvitationTokenService,
    MembershipInvitationDelivery,
    MembershipInvitationCreateRequestGuard,
    MembershipInvitationAcceptRequestGuard,
    CreateMembershipInvitation,
    AcceptMembershipInvitation,
    RevokeMembershipInvitation,
    PrismaMembershipsRepository,
    PrismaMembershipInvitationsRepository,
    SmtpMembershipInvitationSender,
    MembershipInvitationRateLimiter,
    {
      provide: MEMBERSHIPS_REPOSITORY,
      useExisting: PrismaMembershipsRepository,
    },
    {
      provide: MEMBERSHIP_INVITATIONS_REPOSITORY,
      useExisting: PrismaMembershipInvitationsRepository,
    },
    {
      provide: MEMBERSHIP_INVITATION_SENDER,
      useExisting: SmtpMembershipInvitationSender,
    },
    {
      provide: MEMBERSHIP_INVITATION_RATE_LIMITER,
      useExisting: MembershipInvitationRateLimiter,
    },
  ],
  exports: [Memberships],
})
export class MembershipsModule {}
