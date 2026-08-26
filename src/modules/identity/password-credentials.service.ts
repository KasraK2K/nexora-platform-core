import { Inject, Injectable } from '@nestjs/common';
import {
  PASSWORD_VERIFIER,
  type PasswordVerifier,
} from './security/password-verifier';
import { PasswordCredentialsRepository } from './password-credentials.repository';

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
    private readonly credentials: PasswordCredentialsRepository,
    @Inject(PASSWORD_VERIFIER)
    private readonly passwordVerifier: PasswordVerifier,
  ) {}

  /** Verifies normalized credentials and returns only the identity identifier. */
  async authenticate(input: {
    email: string;
    password: string;
  }): Promise<{ identityId: string } | null> {
    const identity = await this.credentials.findByNormalizedEmail(
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
    return this.credentials.replacePasswordHash(identityId, passwordHash);
  }

  /** Creates an opaque proof after verifying the current password. */
  async verify(input: {
    identityId: string;
    password: string;
  }): Promise<VerifiedPasswordCredential | null> {
    const credential = await this.credentials.findByIdentityId(
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
    return this.credentials.replacePasswordHashIfCurrent({
      identityId: verified.identityId,
      expectedPasswordHash: verified[VERIFIED_PASSWORD_HASH],
      passwordHash,
    });
  }
}
