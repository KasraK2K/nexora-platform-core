import type { InvitableMembershipRole } from './membership-role';

export const MEMBERSHIP_INVITATION_SENDER = Symbol(
  'MEMBERSHIP_INVITATION_SENDER',
);

export interface MembershipInvitationSender {
  send(input: {
    to: string;
    token: string;
    role: InvitableMembershipRole;
    expiresAt: Date;
  }): Promise<void>;
}
