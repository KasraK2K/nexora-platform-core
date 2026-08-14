import { Inject, Injectable } from '@nestjs/common';
import {
  PASSWORD_VERIFIER,
  type PasswordVerifier,
} from './password-verifier.port';

/** Injection token for password-backed identity authentication reads. */
export const PASSWORD_IDENTITY_REPOSITORY = Symbol(
  'PASSWORD_IDENTITY_REPOSITORY',
);

type PasswordIdentityRecord = {
  identityId: string;
  passwordHash: string;
};

/** Storage boundary that keeps password records inside the Identity module. */
export interface PasswordIdentityRepository {
  /** Returns password material for a canonical email, or `null`. */
  findByNormalizedEmail(
    normalizedEmail: string,
  ): Promise<PasswordIdentityRecord | null>;
}

/** Authenticates normalized email/password credentials without exposing hashes. */
@Injectable()
export class PasswordIdentityAuthentication {
  constructor(
    @Inject(PASSWORD_IDENTITY_REPOSITORY)
    private readonly identities: PasswordIdentityRepository,
    @Inject(PASSWORD_VERIFIER)
    private readonly passwordVerifier: PasswordVerifier,
  ) {}

  /**
   * Returns only the stable identity ID on success and `null` otherwise.
   * Unknown emails still incur password verification to reduce timing leakage.
   */
  async authenticate(input: {
    email: string;
    password: string;
  }): Promise<{ identityId: string } | null> {
    const normalizedEmail = input.email.trim().toLocaleLowerCase('en-US');
    const password = input.password.normalize('NFC');
    const identity =
      await this.identities.findByNormalizedEmail(normalizedEmail);
    const matches = await this.passwordVerifier.matches(
      password,
      identity?.passwordHash ?? null,
    );

    return matches && identity ? { identityId: identity.identityId } : null;
  }
}
