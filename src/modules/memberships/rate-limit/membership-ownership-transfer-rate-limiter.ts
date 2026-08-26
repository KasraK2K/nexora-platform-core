/** Result of an ownership-transfer rate-limit check. */
export type MembershipOwnershipTransferRateLimitDecision = Readonly<{
  allowed: boolean;
  retryAfterSeconds: number;
}>;
