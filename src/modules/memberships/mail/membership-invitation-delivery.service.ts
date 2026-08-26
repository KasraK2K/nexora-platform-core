import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config';
import { MailService } from '../../mail/mail.service';
import { Clock } from '../../../common/clock';
import type { InvitableMembershipRole } from '../membership-role';
import { MembershipInvitationsRepository } from '../repositories/membership-invitations.repository';

/** Stages invitation email in the durable mail outbox and attempts delivery. */
@Injectable()
export class MembershipInvitationDeliveryService {
  constructor(
    private readonly outbox: MailService,
    private readonly invitations: MembershipInvitationsRepository,
    private readonly clock: Clock,
    private readonly config: AppConfig,
  ) {}

  /**
   * Enqueues the raw token inside the caller's invitation transaction.
   * The token is placed in the URL fragment so ordinary HTTP requests omit it.
   */
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

  /**
   * Attempts delivery after commit and records only coarse status.
   * Status persistence is best effort and never rolls back the invitation.
   */
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
