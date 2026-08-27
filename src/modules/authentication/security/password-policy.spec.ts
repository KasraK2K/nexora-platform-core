import {
  InvalidRegistrationError,
  InvalidPasswordChangePasswordError,
} from '../errors/authentication.errors';
import { PasswordPolicy } from './password-policy';

describe('PasswordPolicy', () => {
  const policy = new PasswordPolicy();

  it('keeps NFC normalization and the 15 to 128 code-point policy', () => {
    expect(policy.validateAndNormalize('A secure passphrase 123')).toBe(
      'A secure passphrase 123',
    );
    expect(() => policy.validateAndNormalize('too short')).toThrow(
      InvalidRegistrationError,
    );
    expect(() => policy.validateChangedPassword('x'.repeat(129))).toThrow(
      InvalidPasswordChangePasswordError,
    );
  });
});
