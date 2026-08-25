import { Inject, Injectable } from '@nestjs/common';
import {
  IDENTITY_LOOKUP_REPOSITORY,
  IDENTITY_REGISTRATION_REPOSITORY,
  type CreatePasswordIdentity,
  type IdentityLookupRepository,
  type IdentityRegistrationRepository,
  type IdentitySummary,
} from './repositories/identity.repository';

export type {
  CreatePasswordIdentity,
  IdentitySummary,
} from './repositories/identity.repository';
export { IdentityAlreadyExistsError } from './domain/identity-already-exists.error';

/** Produces the canonical case-insensitive email key used by Identity. */
export function normalizeIdentityEmail(email: string): string {
  return email.trim().toLocaleLowerCase('en-US');
}

/** Public service for creating and looking up stable identity principals. */
@Injectable()
export class IdentityService {
  constructor(
    @Inject(IDENTITY_REGISTRATION_REPOSITORY)
    private readonly registrations: IdentityRegistrationRepository,
    @Inject(IDENTITY_LOOKUP_REPOSITORY)
    private readonly identities: IdentityLookupRepository,
  ) {}

  /** Persists a password identity inside the caller-owned transaction. */
  createPasswordIdentity(input: CreatePasswordIdentity): Promise<void> {
    return this.registrations.createPasswordIdentity(input);
  }

  /** Finds an identity by canonical email without exposing credentials. */
  findByEmail(email: string): Promise<IdentitySummary | null> {
    return this.identities.findByNormalizedEmail(normalizeIdentityEmail(email));
  }

  /** Finds a public identity summary by its stable identifier. */
  findById(id: string): Promise<IdentitySummary | null> {
    return this.identities.findById(id);
  }
}
