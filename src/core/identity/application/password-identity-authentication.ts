import { Inject, Injectable } from '@nestjs/common';
import {
  PASSWORD_VERIFIER,
  type PasswordVerifier,
} from './password-verifier.port';

export const PASSWORD_IDENTITY_REPOSITORY = Symbol(
  'PASSWORD_IDENTITY_REPOSITORY',
);

type PasswordIdentityRecord = {
  identityId: string;
  passwordHash: string;
};

export interface PasswordIdentityRepository {
  findByNormalizedEmail(
    normalizedEmail: string,
  ): Promise<PasswordIdentityRecord | null>;
}

@Injectable()
export class PasswordIdentityAuthentication {
  constructor(
    @Inject(PASSWORD_IDENTITY_REPOSITORY)
    private readonly identities: PasswordIdentityRepository,
    @Inject(PASSWORD_VERIFIER)
    private readonly passwordVerifier: PasswordVerifier,
  ) {}

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
