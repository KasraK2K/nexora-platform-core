/** Injection token for the fail-closed ownership-transfer limiter. */
export const MEMBERSHIP_OWNERSHIP_TRANSFER_RATE_LIMITER = Symbol(
  'MEMBERSHIP_OWNERSHIP_TRANSFER_RATE_LIMITER',
);

/** Result of an ownership-transfer rate-limit check. */
export type MembershipOwnershipTransferRateLimitDecision = Readonly<{
  allowed: boolean;
  retryAfterSeconds: number;
}>;

/** Limits step-up ownership attempts by client and trusted session/workspace. */
export interface MembershipOwnershipTransferRateLimiterPort {
  /** Checks whether the authenticated request may attempt a transfer now. */
  check(input: {
    clientIp: string;
    sessionId: string;
    workspaceId: string;
  }): Promise<MembershipOwnershipTransferRateLimitDecision>;
}
