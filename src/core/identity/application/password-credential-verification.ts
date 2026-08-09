import { Inject, Injectable } from '@nestjs/common';
import {
  PASSWORD_VERIFIER,
  type PasswordVerifier,
} from './password-verifier.port';

export const PASSWORD_CREDENTIAL_VERIFICATION_REPOSITORY = Symbol(
  'PASSWORD_CREDENTIAL_VERIFICATION_REPOSITORY',
);

type PasswordCredentialRecord = {
  identityId: string;
  passwordHash: string;
};

const VERIFIED_PASSWORD_HASH = Symbol('VERIFIED_PASSWORD_HASH');

export type VerifiedPasswordCredential = Readonly<{
  identityId: string;
  [VERIFIED_PASSWORD_HASH]: string;
}>;

export interface PasswordCredentialVerificationRepository {
  findByIdentityId(
    identityId: string,
  ): Promise<PasswordCredentialRecord | null>;
  replacePasswordHashIfCurrent(input: {
    identityId: string;
    expectedPasswordHash: string;
    passwordHash: string;
  }): Promise<boolean>;
}

@Injectable()
export class PasswordCredentialVerification {
  constructor(
    @Inject(PASSWORD_CREDENTIAL_VERIFICATION_REPOSITORY)
    private readonly repository: PasswordCredentialVerificationRepository,
    @Inject(PASSWORD_VERIFIER)
    private readonly passwordVerifier: PasswordVerifier,
  ) {}

  async verify(input: {
    identityId: string;
    password: string;
  }): Promise<VerifiedPasswordCredential | null> {
    const credential = await this.repository.findByIdentityId(input.identityId);
    const matches = await this.passwordVerifier.matches(
      input.password.normalize('NFC'),
      credential?.passwordHash ?? null,
    );
    return matches && credential
      ? {
          identityId: credential.identityId,
          [VERIFIED_PASSWORD_HASH]: credential.passwordHash,
        }
      : null;
  }

  replacePasswordHashIfVerified(
    verified: VerifiedPasswordCredential,
    passwordHash: string,
  ): Promise<boolean> {
    return this.repository.replacePasswordHashIfCurrent({
      identityId: verified.identityId,
      expectedPasswordHash: verified[VERIFIED_PASSWORD_HASH],
      passwordHash,
    });
  }
}
