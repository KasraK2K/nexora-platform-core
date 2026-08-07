export const PASSWORD_COMPROMISE_CHECKER = Symbol(
  'PASSWORD_COMPROMISE_CHECKER',
);

export interface PasswordCompromiseChecker {
  isCompromised(password: string): Promise<boolean>;
}
