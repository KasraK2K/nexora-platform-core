export const MEMBERSHIP_INVITATION_RATE_LIMITER = Symbol(
  'MEMBERSHIP_INVITATION_RATE_LIMITER',
);

export type MembershipInvitationRateLimitDecision = Readonly<{
  allowed: boolean;
  retryAfterSeconds: number;
}>;

export interface MembershipInvitationRateLimiterPort {
  checkCreate(input: {
    clientIp: string;
    actorUserId: string;
    workspaceId: string;
    normalizedEmail?: string;
  }): Promise<MembershipInvitationRateLimitDecision>;
  checkAccept(input: {
    clientIp: string;
    sessionId: string;
  }): Promise<MembershipInvitationRateLimitDecision>;
}
