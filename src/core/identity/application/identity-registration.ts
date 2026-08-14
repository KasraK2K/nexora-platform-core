import { Inject, Injectable } from '@nestjs/common';

/** Injection token for the password-identity creation adapter. */
export const IDENTITY_REGISTRATION_REPOSITORY = Symbol(
  'IDENTITY_REGISTRATION_REPOSITORY',
);

/** Complete persistence input for one password-backed principal. */
export type CreatePasswordIdentity = {
  identityId: string;
  normalizedEmail: string;
  passwordHash: string;
};

/** Identity-owned write boundary used by account-registration orchestration. */
export interface IdentityRegistrationRepository {
  /** Persists the principal and password credential through the caller's transaction. */
  createPasswordIdentity(input: CreatePasswordIdentity): Promise<void>;
}

/** Application facade for creating a password-backed identity. */
@Injectable()
export class IdentityRegistration {
  constructor(
    @Inject(IDENTITY_REGISTRATION_REPOSITORY)
    private readonly repository: IdentityRegistrationRepository,
  ) {}

  /** Delegates creation to the current transaction-aware storage adapter. */
  createPasswordIdentity(input: CreatePasswordIdentity): Promise<void> {
    return this.repository.createPasswordIdentity(input);
  }
}
