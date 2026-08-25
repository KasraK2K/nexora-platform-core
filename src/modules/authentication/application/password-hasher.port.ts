/** Injection token for the password hashing boundary. */
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

/** Converts an already validated plaintext password into a stored hash. */
export interface PasswordHasher {
  /** Produces the encoded credential hash stored for a validated password. */
  hash(password: string): Promise<string>;
}
