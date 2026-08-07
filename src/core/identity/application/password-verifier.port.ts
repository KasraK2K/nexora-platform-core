export const PASSWORD_VERIFIER = Symbol('PASSWORD_VERIFIER');

export interface PasswordVerifier {
  matches(password: string, passwordHash: string | null): Promise<boolean>;
}
