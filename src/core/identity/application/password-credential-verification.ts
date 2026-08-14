import { Inject, Injectable } from '@nestjs/common';
import {
  PASSWORD_VERIFIER,
  type PasswordVerifier,
} from './password-verifier.port';

/** Injection token for verified password credential reads and CAS writes. */
export const PASSWORD_CREDENTIAL_VERIFICATION_REPOSITORY = Symbol(
  'PASSWORD_CREDENTIAL_VERIFICATION_REPOSITORY',
);

type PasswordCredentialRecord = {
  identityId: string;
  passwordHash: string;
};

/** Private brand carrying the exact hash observed during successful verification. */
const VERIFIED_PASSWORD_HASH = Symbol('VERIFIED_PASSWORD_HASH');

/**
 * Proof that a caller verified the current password hash.
 *
 * The private symbol keeps callers from constructing proof without this module.
 */
export type VerifiedPasswordCredential = Readonly<{
  identityId: string;
  [VERIFIED_PASSWORD_HASH]: string;
}>;

/** Persistence boundary for verification and compare-and-swap hash changes. */
export interface PasswordCredentialVerificationRepository {
  /** Returns the current password record for an identity, or `null`. */
  findByIdentityId(
    identityId: string,
  ): Promise<PasswordCredentialRecord | null>;
  /** Replaces the hash only while the expected current hash still matches. */
  replacePasswordHashIfCurrent(input: {
    identityId: string;
    expectedPasswordHash: string;
    passwordHash: string;
  }): Promise<boolean>;
}

/** Verifies current credentials and issues module-private replacement proof. */
@Injectable()
export class PasswordCredentialVerification {
  constructor(
    @Inject(PASSWORD_CREDENTIAL_VERIFICATION_REPOSITORY)
    private readonly repository: PasswordCredentialVerificationRepository,
    @Inject(PASSWORD_VERIFIER)
    private readonly passwordVerifier: PasswordVerifier,
  ) {}

  /**
   * Verifies an NFC-normalized password and returns `null` on any mismatch.
   * Missing credentials still pass through the verifier's dummy-hash path.
   */
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

  /**
   * Replaces the hash only while the verified hash is still current.
   * `false` means another writer changed or removed the credential first.
   */
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
