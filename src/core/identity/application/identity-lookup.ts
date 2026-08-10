import { Inject, Injectable } from '@nestjs/common';

export const IDENTITY_LOOKUP_REPOSITORY = Symbol('IDENTITY_LOOKUP_REPOSITORY');

export type IdentitySummary = { id: string; normalizedEmail: string };

export function normalizeIdentityEmail(email: string): string {
  return email.trim().toLocaleLowerCase('en-US');
}

export interface IdentityLookupRepository {
  findByNormalizedEmail(email: string): Promise<IdentitySummary | null>;
  findById(id: string): Promise<IdentitySummary | null>;
}

@Injectable()
export class IdentityLookup {
  constructor(
    @Inject(IDENTITY_LOOKUP_REPOSITORY)
    private readonly repository: IdentityLookupRepository,
  ) {}

  findByEmail(email: string): Promise<IdentitySummary | null> {
    return this.repository.findByNormalizedEmail(normalizeIdentityEmail(email));
  }

  findById(id: string): Promise<IdentitySummary | null> {
    return this.repository.findById(id);
  }
}
