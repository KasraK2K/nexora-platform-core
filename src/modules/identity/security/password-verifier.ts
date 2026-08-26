/** Injection token for the password-hash verification boundary. */
export const PASSWORD_VERIFIER = Symbol('PASSWORD_VERIFIER');

/** Cryptographic boundary for matching plaintext input against a stored hash. */
export interface PasswordVerifier {
  /** Compares a candidate password with a stored hash without leaking details. */
  matches(password: string, passwordHash: string | null): Promise<boolean>;
}
