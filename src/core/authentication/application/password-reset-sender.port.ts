export const PASSWORD_RESET_SENDER = Symbol('PASSWORD_RESET_SENDER');

export interface PasswordResetSender {
  send(input: { to: string; token: string; expiresAt: Date }): Promise<void>;
}
