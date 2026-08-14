import { Inject, Injectable } from '@nestjs/common';

/** Injection token for the storage adapter that reads identity summaries. */
export const IDENTITY_LOOKUP_REPOSITORY = Symbol('IDENTITY_LOOKUP_REPOSITORY');

/** Minimal Identity-owned view exposed to application consumers. */
export type IdentitySummary = { id: string; normalizedEmail: string };

/** Produces the canonical email form used for Identity uniqueness and lookup. */
export function normalizeIdentityEmail(email: string): string {
  return email.trim().toLocaleLowerCase('en-US');
}

/** Storage boundary for Identity-owned principal lookups. */
export interface IdentityLookupRepository {
  /** Returns the principal matching a canonical email, or `null`. */
  findByNormalizedEmail(email: string): Promise<IdentitySummary | null>;
  /** Returns the principal matching a stable identity ID, or `null`. */
  findById(id: string): Promise<IdentitySummary | null>;
}

/** Public Identity query service; absence is represented by `null`. */
@Injectable()
export class IdentityLookup {
  constructor(
    @Inject(IDENTITY_LOOKUP_REPOSITORY)
    private readonly repository: IdentityLookupRepository,
  ) {}

  /** Finds an identity after applying Identity's canonical email normalization. */
  findByEmail(email: string): Promise<IdentitySummary | null> {
    return this.repository.findByNormalizedEmail(normalizeIdentityEmail(email));
  }

  /** Finds an identity by its stable principal ID, or returns `null`. */
  findById(id: string): Promise<IdentitySummary | null> {
    return this.repository.findById(id);
  }
}
