export const AUTHENTICATION_RATE_LIMITER = Symbol(
  'AUTHENTICATION_RATE_LIMITER',
);

export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export interface AuthenticationRateLimitPort {
  checkRegistration(
    clientIp: string,
    normalizedEmail?: string,
  ): Promise<RateLimitDecision>;
  checkLogin(
    clientIp: string,
    normalizedEmail?: string,
  ): Promise<RateLimitDecision>;
  checkEmailVerificationRequest(
    clientIp: string,
    normalizedEmail?: string,
  ): Promise<RateLimitDecision>;
  checkEmailVerificationConfirmation(
    clientIp: string,
  ): Promise<RateLimitDecision>;
  checkPasswordResetRequest(
    clientIp: string,
    normalizedEmail?: string,
  ): Promise<RateLimitDecision>;
  checkPasswordResetConfirmation(clientIp: string): Promise<RateLimitDecision>;
  checkPasswordChange(
    clientIp: string,
    sessionToken?: string,
  ): Promise<RateLimitDecision>;
}
