import { Inject, Injectable } from '@nestjs/common';
import { AppConfig } from '../../configuration/app-config';
import {
  OUTBOUND_MAIL,
  type OutboundMail,
} from '../../mail/application/outbound-mail.port';
import type { MembershipInvitationSender } from '../application/membership-invitation-sender.port';
import type { InvitableMembershipRole } from '../application/membership-role';

@Injectable()
export class SmtpMembershipInvitationSender implements MembershipInvitationSender {
  constructor(
    private readonly config: AppConfig,
    @Inject(OUTBOUND_MAIL) private readonly mail: OutboundMail,
  ) {}

  async send(input: {
    to: string;
    token: string;
    role: InvitableMembershipRole;
    expiresAt: Date;
  }): Promise<void> {
    const invitationUrl = new URL(this.config.membershipInvitationUrl);
    invitationUrl.searchParams.set('token', input.token);

    await this.mail.send({
      to: input.to,
      subject: 'Workspace membership invitation',
      text: [
        `You were invited to a workspace as ${input.role}.`,
        'Sign in with this email address and open the invitation link:',
        invitationUrl.toString(),
        `This link expires at ${input.expiresAt.toISOString()}.`,
        'If you were not expecting this invitation, you can ignore this email.',
      ].join('\n\n'),
    });
  }
}
