/** Injection token for sign-in credential lookup. */
export const PASSWORD_IDENTITY_REPOSITORY = Symbol(
  'PASSWORD_IDENTITY_REPOSITORY',
);
/** Injection token for caller-authorized hash replacement. */
export const PASSWORD_CREDENTIAL_MANAGEMENT_REPOSITORY = Symbol(
  'PASSWORD_CREDENTIAL_MANAGEMENT_REPOSITORY',
);
/** Injection token for current-hash verification and compare-and-set writes. */
export const PASSWORD_CREDENTIAL_VERIFICATION_REPOSITORY = Symbol(
  'PASSWORD_CREDENTIAL_VERIFICATION_REPOSITORY',
);

/** Stored credential facts required by sign-in. */
export type PasswordIdentityRecord = {
  identityId: string;
  passwordHash: string;
};
/** Stored credential facts required by step-up verification. */
export type PasswordCredentialRecord = {
  identityId: string;
  passwordHash: string;
};

/** Persistence boundary for sign-in credential lookup. */
export interface PasswordIdentityRepository {
  /** Finds a credential hash by normalized email. */
  findByNormalizedEmail(
    normalizedEmail: string,
  ): Promise<PasswordIdentityRecord | null>;
}

/** Persistence boundary for caller-authorized password replacement. */
export interface PasswordCredentialManagementRepository {
  /** Replaces the stored hash for one identity. */
  replacePasswordHash(
    identityId: string,
    passwordHash: string,
  ): Promise<boolean>;
}

/** Persistence boundary for password step-up and stale-write protection. */
export interface PasswordCredentialVerificationRepository {
  /** Reads the current hash by identity identifier. */
  findByIdentityId(
    identityId: string,
  ): Promise<PasswordCredentialRecord | null>;
  /** Replaces the hash only if the expected hash remains current. */
  replacePasswordHashIfCurrent(input: {
    identityId: string;
    expectedPasswordHash: string;
    passwordHash: string;
  }): Promise<boolean>;
}
