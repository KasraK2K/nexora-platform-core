import { Inject, Injectable } from '@nestjs/common';

/** Injection token for the Organizations-owned persistence adapter. */
export const ORGANIZATIONS_REPOSITORY = Symbol('ORGANIZATIONS_REPOSITORY');

/** Minimal commercial-boundary view exposed to Core consumers. */
export type OrganizationSummary = { id: string; name: string };

/** Persistence boundary for Organization-owned commercial state. */
export interface OrganizationsRepository {
  /** Persists a commercial organization through the caller's transaction. */
  create(input: {
    id: string;
    ownerUserId: string;
    name: string;
  }): Promise<void>;
  /** Returns one commercial organization summary, or `null`. */
  findById(id: string): Promise<OrganizationSummary | null>;
  /** Batch-loads matching summaries and omits absent IDs. */
  findByIds(ids: readonly string[]): Promise<OrganizationSummary[]>;
}

/** Public application facade for commercial organization records. */
@Injectable()
export class Organizations {
  constructor(
    @Inject(ORGANIZATIONS_REPOSITORY)
    private readonly repository: OrganizationsRepository,
  ) {}

  /**
   * Creates a commercial organization with its initial owner.
   * Operational workspace ownership changes do not alter `ownerUserId`.
   */
  create(input: {
    id: string;
    ownerUserId: string;
    name: string;
  }): Promise<void> {
    return this.repository.create(input);
  }

  /** Finds a commercial organization by ID, or returns `null`. */
  findById(id: string): Promise<OrganizationSummary | null> {
    return this.repository.findById(id);
  }

  /** Batch-loads organization summaries; absent IDs are omitted. */
  findByIds(ids: readonly string[]): Promise<OrganizationSummary[]> {
    return this.repository.findByIds(ids);
  }
}
