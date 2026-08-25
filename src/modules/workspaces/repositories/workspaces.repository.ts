/** Injection token for the Workspaces-owned persistence adapter. */
export const WORKSPACES_REPOSITORY = Symbol('WORKSPACES_REPOSITORY');

/** Minimal operational-tenant view exposed to Core consumers. */
export type WorkspaceSummary = {
  id: string;
  organizationId: string;
  name: string;
};

/** Persistence boundary for Workspace-owned tenant state. */
export interface WorkspacesRepository {
  /** Inserts a workspace inside the caller-owned transaction. */
  create(input: {
    id: string;
    organizationId: string;
    name: string;
  }): Promise<void>;
  /** Finds a workspace by stable identifier. */
  findById(id: string): Promise<WorkspaceSummary | null>;
  /** Resolves a bounded set of workspace summaries. */
  findByIds(ids: readonly string[]): Promise<WorkspaceSummary[]>;
  /** Compare-and-set renames one organization-scoped workspace. */
  rename(input: {
    id: string;
    organizationId: string;
    expectedName: string;
    name: string;
  }): Promise<boolean>;
}
