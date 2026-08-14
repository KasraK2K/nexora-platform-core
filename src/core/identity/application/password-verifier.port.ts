/** Injection token for the password-hash verification adapter. */
export const PASSWORD_VERIFIER = Symbol('PASSWORD_VERIFIER');

/** Cryptographic boundary for matching plaintext input against a stored hash. */
export interface PasswordVerifier {
  /** Performs password-hash verification, including the adapter's absent-hash path. */
  matches(password: string, passwordHash: string | null): Promise<boolean>;
}
