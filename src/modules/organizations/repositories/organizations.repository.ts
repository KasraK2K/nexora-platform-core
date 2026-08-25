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
