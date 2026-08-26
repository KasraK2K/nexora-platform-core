/** Result of one rate-limit check, including the client retry delay. */
export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
};
