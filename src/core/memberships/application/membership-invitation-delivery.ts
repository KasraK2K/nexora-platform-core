import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../configuration/app-config';
import { MailOutbox } from '../../mail/application/mail-outbox';
import { Clock } from '../../../shared/application/clock';
import type { InvitableMembershipRole } from './membership-role';
import { MembershipInvitations } from './membership-invitations';

@Injectable()
export class MembershipInvitationDelivery {
  constructor(
    private readonly outbox: MailOutbox,
    private readonly invitations: MembershipInvitations,
    private readonly clock: Clock,
    private readonly config: AppConfig,
  ) {}

  async enqueue(input: {
    workspaceId: string;
    invitationId: string;
    email: string;
    token: string;
    role: InvitableMembershipRole;
    expiresAt: Date;
  }): Promise<void> {
    const url = new URL(this.config.membershipInvitationUrl);
    url.hash = `token=${encodeURIComponent(input.token)}`;
    await this.outbox.enqueue({
      id: input.invitationId,
      workspaceId: input.workspaceId,
      purpose: 'MEMBERSHIP_INVITATION',
      to: input.email,
      subject: 'Workspace membership invitation',
      text: [
        `You were invited to a workspace as ${input.role}.`,
        'Sign in with this email address and open the invitation link:',
        url.toString(),
        `This link expires at ${input.expiresAt.toISOString()}.`,
        'If you were not expecting this invitation, you can ignore this email.',
      ].join('\n\n'),
      expiresAt: input.expiresAt,
    });
  }

  async attempt(input: {
    workspaceId: string;
    invitationId: string;
  }): Promise<boolean> {
    const sent = await this.outbox.deliverNow(input.invitationId);
    await this.invitations
      .markDelivery(
        input.workspaceId,
        input.invitationId,
        sent ? 'SENT' : 'FAILED',
        this.clock.now(),
      )
      .catch(() => undefined);
    return sent;
  }
}
