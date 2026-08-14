/** Injection token for the authentication throttling boundary. */
export const AUTHENTICATION_RATE_LIMITER = Symbol(
  'AUTHENTICATION_RATE_LIMITER',
);

/** Result of one rate-limit check, including the client retry delay. */
export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
};

/**
 * Applies operation-specific limits before authentication performs expensive
 * password work or reveals whether an account exists.
 */
export interface AuthenticationRateLimitPort {
  /** Checks registration attempts by client IP and optional normalized email. */
  checkRegistration(
    clientIp: string,
    normalizedEmail?: string,
  ): Promise<RateLimitDecision>;
  /** Checks login attempts by client IP and optional normalized email. */
  checkLogin(
    clientIp: string,
    normalizedEmail?: string,
  ): Promise<RateLimitDecision>;
  /** Checks verification-link requests before account lookup or mail work. */
  checkEmailVerificationRequest(
    clientIp: string,
    normalizedEmail?: string,
  ): Promise<RateLimitDecision>;
  /** Checks verification confirmations before token lookup. */
  checkEmailVerificationConfirmation(
    clientIp: string,
  ): Promise<RateLimitDecision>;
  /** Checks reset-link requests before account lookup or mail work. */
  checkPasswordResetRequest(
    clientIp: string,
    normalizedEmail?: string,
  ): Promise<RateLimitDecision>;
  /** Checks reset confirmations before token and password processing. */
  checkPasswordResetConfirmation(clientIp: string): Promise<RateLimitDecision>;
  /** Checks password changes by client IP and optional opaque session secret. */
  checkPasswordChange(
    clientIp: string,
    sessionToken?: string,
  ): Promise<RateLimitDecision>;
  /** Checks workspace switches by client IP and optional opaque session secret. */
  checkWorkspaceSwitch(
    clientIp: string,
    sessionToken?: string,
  ): Promise<RateLimitDecision>;
}
