export const MEMBERSHIP_OWNERSHIP_TRANSFER_RATE_LIMITER = Symbol(
  'MEMBERSHIP_OWNERSHIP_TRANSFER_RATE_LIMITER',
);

export type MembershipOwnershipTransferRateLimitDecision = Readonly<{
  allowed: boolean;
  retryAfterSeconds: number;
}>;

export interface MembershipOwnershipTransferRateLimiterPort {
  check(input: {
    clientIp: string;
    sessionId: string;
    workspaceId: string;
  }): Promise<MembershipOwnershipTransferRateLimitDecision>;
}
