import {
  InvalidPasswordResetPasswordError,
  InvalidRegistrationError,
} from './registration.errors';

export class PasswordPolicy {
  validateAndNormalize(password: string): string {
    return this.validate(
      password,
      () =>
        new InvalidRegistrationError(
          'Password must contain between 15 and 128 Unicode characters.',
        ),
    );
  }

  validateResetPassword(password: string): string {
    return this.validate(
      password,
      () => new InvalidPasswordResetPasswordError(),
    );
  }

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
