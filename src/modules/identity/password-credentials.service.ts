import { Inject, Injectable } from '@nestjs/common';
import {
  PASSWORD_VERIFIER,
  type PasswordVerifier,
} from './ports/password-verifier.port';
import {
  PASSWORD_CREDENTIAL_MANAGEMENT_REPOSITORY,
  PASSWORD_CREDENTIAL_VERIFICATION_REPOSITORY,
  PASSWORD_IDENTITY_REPOSITORY,
  type PasswordCredentialManagementRepository,
  type PasswordCredentialVerificationRepository,
  type PasswordIdentityRepository,
} from './repositories/password-credentials.repository';

export type {
  PasswordCredentialManagementRepository,
  PasswordCredentialVerificationRepository,
  PasswordIdentityRepository,
} from './repositories/password-credentials.repository';

const VERIFIED_PASSWORD_HASH = Symbol('VERIFIED_PASSWORD_HASH');

/** Opaque proof that the caller verified the currently stored password hash. */
export type VerifiedPasswordCredential = Readonly<{
  identityId: string;
  [VERIFIED_PASSWORD_HASH]: string;
}>;

/** Public service for password authentication, verification, and replacement. */
@Injectable()
export class PasswordCredentialsService {
  constructor(
    @Inject(PASSWORD_IDENTITY_REPOSITORY)
    private readonly identities: PasswordIdentityRepository,
    @Inject(PASSWORD_CREDENTIAL_MANAGEMENT_REPOSITORY)
    private readonly management: PasswordCredentialManagementRepository,
    @Inject(PASSWORD_CREDENTIAL_VERIFICATION_REPOSITORY)
    private readonly verification: PasswordCredentialVerificationRepository,
    @Inject(PASSWORD_VERIFIER)
    private readonly passwordVerifier: PasswordVerifier,
  ) {}

  /** Verifies normalized credentials and returns only the identity identifier. */
  async authenticate(input: {
    email: string;
    password: string;
  }): Promise<{ identityId: string } | null> {
    const identity = await this.identities.findByNormalizedEmail(
      input.email.trim().toLocaleLowerCase('en-US'),
    );
    const matches = await this.passwordVerifier.matches(
      input.password.normalize('NFC'),
      identity?.passwordHash ?? null,
    );
    return matches && identity ? { identityId: identity.identityId } : null;
  }

  /** Replaces the stored password hash inside the caller-owned transaction. */
  replacePasswordHash(
    identityId: string,
    passwordHash: string,
  ): Promise<boolean> {
    return this.management.replacePasswordHash(identityId, passwordHash);
  }

  /** Creates an opaque proof after verifying the current password. */
  async verify(input: {
    identityId: string;
    password: string;
  }): Promise<VerifiedPasswordCredential | null> {
    const credential = await this.verification.findByIdentityId(
      input.identityId,
    );
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

  /** Replaces a hash only when the previously verified hash is still current. */
  replacePasswordHashIfVerified(
    verified: VerifiedPasswordCredential,
    passwordHash: string,
  ): Promise<boolean> {
    return this.verification.replacePasswordHashIfCurrent({
      identityId: verified.identityId,
      expectedPasswordHash: verified[VERIFIED_PASSWORD_HASH],
      passwordHash,
    });
  }
}
