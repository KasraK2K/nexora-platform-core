import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config';
import { MailService } from '../../mail/mail.service';

/** Stages invitation email in the durable outbox for asynchronous delivery. */
@Injectable()
export class MembershipInvitationDeliveryService {
  constructor(
    private readonly outbox: MailService,
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
        'You were invited to join a workspace as a member.',
        'Sign in with this email address and open the invitation link:',
        url.toString(),
        `This link expires at ${input.expiresAt.toISOString()}.`,
        'If you were not expecting this invitation, you can ignore this email.',
      ].join('\n\n'),
      expiresAt: input.expiresAt,
    });
  }
}
