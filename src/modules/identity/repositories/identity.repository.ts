/** Injection token for identity creation persistence. */
export const IDENTITY_REGISTRATION_REPOSITORY = Symbol(
  'IDENTITY_REGISTRATION_REPOSITORY',
);
/** Injection token for read-only identity lookup persistence. */
export const IDENTITY_LOOKUP_REPOSITORY = Symbol('IDENTITY_LOOKUP_REPOSITORY');

/** Password identity facts written during registration. */
export type CreatePasswordIdentity = {
  identityId: string;
  normalizedEmail: string;
  passwordHash: string;
};
/** Public identity view that never exposes credential material. */
export type IdentitySummary = { id: string; normalizedEmail: string };

/** Persistence boundary for creating a password identity. */
export interface IdentityRegistrationRepository {
  /** Inserts identity and credential rows in the active transaction. */
  createPasswordIdentity(input: CreatePasswordIdentity): Promise<void>;
}

/** Persistence boundary for public identity lookup. */
export interface IdentityLookupRepository {
  /** Finds an identity by its already-normalized email key. */
  findByNormalizedEmail(email: string): Promise<IdentitySummary | null>;
  /** Finds an identity by stable identifier. */
  findById(id: string): Promise<IdentitySummary | null>;
}
