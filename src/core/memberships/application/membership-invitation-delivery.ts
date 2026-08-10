import { Inject, Injectable } from '@nestjs/common';
import { Clock } from '../../../shared/application/clock';
import type { InvitableMembershipRole } from './membership-role';
import {
  MEMBERSHIP_INVITATION_SENDER,
  type MembershipInvitationSender,
} from './membership-invitation-sender.port';
import { MembershipInvitations } from './membership-invitations';

@Injectable()
export class MembershipInvitationDelivery {
  constructor(
    @Inject(MEMBERSHIP_INVITATION_SENDER)
    private readonly sender: MembershipInvitationSender,
    private readonly invitations: MembershipInvitations,
    private readonly clock: Clock,
  ) {}

  async attempt(input: {
    workspaceId: string;
    invitationId: string;
    email: string;
    token: string;
    role: InvitableMembershipRole;
    expiresAt: Date;
  }): Promise<boolean> {
    let status: 'SENT' | 'FAILED' = 'SENT';
    try {
      await this.sender.send({
        to: input.email,
        token: input.token,
        role: input.role,
        expiresAt: input.expiresAt,
      });
    } catch {
      status = 'FAILED';
    }

    await this.invitations
      .markDelivery(
        input.workspaceId,
        input.invitationId,
        status,
        this.clock.now(),
      )
      .catch(() => undefined);
    return status === 'SENT';
  }
}
