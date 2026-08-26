import { Injectable } from '@nestjs/common';
import { IdentityRepository } from './identity.repository';
import type { CreatePasswordIdentity, IdentitySummary } from './identity.types';

export type { CreatePasswordIdentity, IdentitySummary } from './identity.types';
export { IdentityAlreadyExistsError } from './identity-already-exists.error';

/** Produces the canonical case-insensitive email key used by Identity. */
export function normalizeIdentityEmail(email: string): string {
  return email.trim().toLocaleLowerCase('en-US');
}

/** Public service for creating and looking up stable identity principals. */
@Injectable()
export class IdentityService {
  constructor(private readonly identities: IdentityRepository) {}

  /** Persists a password identity inside the caller-owned transaction. */
  createPasswordIdentity(input: CreatePasswordIdentity): Promise<void> {
    return this.identities.createPasswordIdentity(input);
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
