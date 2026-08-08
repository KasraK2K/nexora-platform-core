export const EMAIL_VERIFICATION_SENDER = Symbol('EMAIL_VERIFICATION_SENDER');

export interface EmailVerificationSender {
  send(input: { to: string; token: string; expiresAt: Date }): Promise<void>;
}
