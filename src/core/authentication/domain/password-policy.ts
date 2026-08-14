import {
  InvalidPasswordChangePasswordError,
  InvalidPasswordResetPasswordError,
  InvalidRegistrationError,
} from './registration.errors';

/** Enforces the shared normalized password-size policy for authentication flows. */
export class PasswordPolicy {
  /** Normalizes registration input and throws the registration-specific validation error. */
  validateAndNormalize(password: string): string {
    return this.validate(
      password,
      () =>
        new InvalidRegistrationError(
          'Password must contain between 15 and 128 Unicode characters.',
        ),
    );
  }

  /** Normalizes reset input and throws the reset-specific validation error. */
  validateResetPassword(password: string): string {
    return this.validate(
      password,
      () => new InvalidPasswordResetPasswordError(),
    );
  }

  /** Normalizes change input and throws the password-change validation error. */
  validateChangedPassword(password: string): string {
    return this.validate(
      password,
      () => new InvalidPasswordChangePasswordError(),
    );
  }

  /** Applies Unicode code-point and UTF-8 byte limits after NFC normalization. */
  private validate(password: string, createError: () => Error): string {
    const normalized = password.normalize('NFC');
    const codePointLength = [...normalized].length;
    const byteLength = Buffer.byteLength(normalized, 'utf8');

    if (codePointLength < 15 || codePointLength > 128 || byteLength > 512) {
      throw createError();
    }

    return normalized;
  }
}
