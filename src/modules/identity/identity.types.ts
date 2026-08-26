/** Password identity facts written during registration. */
export type CreatePasswordIdentity = {
  identityId: string;
  normalizedEmail: string;
  passwordHash: string;
};

/** Public identity view that never exposes credential material. */
export type IdentitySummary = { id: string; normalizedEmail: string };

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
