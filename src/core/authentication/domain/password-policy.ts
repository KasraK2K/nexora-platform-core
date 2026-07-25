import { InvalidRegistrationError } from './registration.errors';

const COMMON_PASSWORDS = new Set([
  '123456789012345',
  'correct horse battery staple',
  'letmeinletmeinletmein',
  'passwordpassword',
  'qwertyuiopasdfgh',
]);

export class PasswordPolicy {
  validateAndNormalize(password: string): string {
    const normalized = password.normalize('NFC');
    const codePointLength = [...normalized].length;
    const byteLength = Buffer.byteLength(normalized, 'utf8');

    if (codePointLength < 15 || codePointLength > 128 || byteLength > 512) {
      throw new InvalidRegistrationError(
        'Password must contain between 15 and 128 Unicode characters.',
      );
    }

    if (COMMON_PASSWORDS.has(normalized.toLocaleLowerCase('en-US'))) {
      throw new InvalidRegistrationError(
        'Choose a password that is not commonly used.',
      );
    }

    return normalized;
  }
}
