/** Injection token for the fail-closed membership invitation limiter. */
export const MEMBERSHIP_INVITATION_RATE_LIMITER = Symbol(
  'MEMBERSHIP_INVITATION_RATE_LIMITER',
);

/** Result of an invitation rate-limit check, including client retry guidance. */
export type MembershipInvitationRateLimitDecision = Readonly<{
  allowed: boolean;
  retryAfterSeconds: number;
}>;

/**
 * Limits invitation creation by trusted actor/workspace context and acceptance
 * by the authenticated session before either operation reaches a use case.
 */
export interface MembershipInvitationRateLimiterPort {
  /** Checks creation buckets, optionally including the normalized target email. */
  checkCreate(input: {
    clientIp: string;
    actorUserId: string;
    workspaceId: string;
    normalizedEmail?: string;
  }): Promise<MembershipInvitationRateLimitDecision>;
  /** Checks acceptance buckets for the client address and presented session. */
  checkAccept(input: {
    clientIp: string;
    sessionId: string;
  }): Promise<MembershipInvitationRateLimitDecision>;
}
