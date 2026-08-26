/** Result of an invitation rate-limit check, including client retry guidance. */
export type MembershipInvitationRateLimitDecision = Readonly<{
  allowed: boolean;
  retryAfterSeconds: number;
}>;
