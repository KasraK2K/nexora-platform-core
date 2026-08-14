/** Injection token for password breach and deny-list screening. */
export const PASSWORD_COMPROMISE_CHECKER = Symbol(
  'PASSWORD_COMPROMISE_CHECKER',
);

/** Screens a plaintext candidate without retaining or logging it. */
export interface PasswordCompromiseChecker {
  /** Reports whether a plaintext candidate appears in configured compromise data. */
  isCompromised(password: string): Promise<boolean>;
}
