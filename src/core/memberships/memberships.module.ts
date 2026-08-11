import { Module } from '@nestjs/common';
import { MEMBERSHIPS_REPOSITORY, Memberships } from './application/memberships';
import { PrismaMembershipsRepository } from './infrastructure/prisma-memberships.repository';
import { CoreInfrastructureModule } from '../core-infrastructure.module';
import { AuthenticationSessionStateModule } from '../authentication/authentication-session-state.module';
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
import { MembershipsController } from './presentation/memberships.controller';
import {
  MembershipInvitationAcceptRequestGuard,
  MembershipInvitationCreateRequestGuard,
} from './presentation/membership-invitation-request.guard';
import {
  MEMBERSHIP_ADMINISTRATION_REPOSITORY,
  MembershipAdministration,
} from './application/membership-administration';
import { ListWorkspaceMemberships } from './application/list-workspace-memberships.use-case';
import { ChangeMembershipRole } from './application/change-membership-role.use-case';
import { RemoveMembership } from './application/remove-membership.use-case';
import { TransferWorkspaceOwnership } from './application/transfer-workspace-ownership.use-case';
import { LeaveCurrentWorkspace } from './application/leave-current-workspace.use-case';
import { MEMBERSHIP_OWNERSHIP_TRANSFER_RATE_LIMITER } from './application/membership-ownership-transfer-rate-limiter.port';
import { MembershipOwnershipTransferRateLimiter } from './infrastructure/membership-ownership-transfer-rate-limiter';
import { MembershipOwnershipTransferRequestGuard } from './presentation/membership-ownership-transfer-request.guard';

@Module({
  imports: [
    CoreInfrastructureModule,
    AuthenticationSessionStateModule,
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
    Memberships,
    MembershipAdministration,
    InvitedMembershipsWriter,
    MembershipInvitations,
    MembershipInvitationTokenService,
    MembershipInvitationDelivery,
    MembershipInvitationCreateRequestGuard,
    MembershipInvitationAcceptRequestGuard,
    CreateMembershipInvitation,
    AcceptMembershipInvitation,
    RevokeMembershipInvitation,
    ListWorkspaceMemberships,
    ChangeMembershipRole,
    RemoveMembership,
    TransferWorkspaceOwnership,
    LeaveCurrentWorkspace,
    PrismaMembershipsRepository,
    PrismaMembershipInvitationsRepository,
    SmtpMembershipInvitationSender,
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
      provide: MEMBERSHIP_INVITATION_SENDER,
      useExisting: SmtpMembershipInvitationSender,
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
  exports: [Memberships],
})
export class MembershipsModule {}
