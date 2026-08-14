import { Inject, Injectable } from '@nestjs/common';

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
  /** Persists an operational tenant through the caller's transaction. */
  create(input: {
    id: string;
    organizationId: string;
    name: string;
  }): Promise<void>;
  /** Returns one workspace summary, or `null`. */
  findById(id: string): Promise<WorkspaceSummary | null>;
  /** Batch-loads matching workspace summaries and omits absent IDs. */
  findByIds(ids: readonly string[]): Promise<WorkspaceSummary[]>;
  /** Renames only while the organization and expected-name preconditions hold. */
  rename(input: {
    id: string;
    organizationId: string;
    expectedName: string;
    name: string;
  }): Promise<boolean>;
}

/** Public application facade for operational workspace records. */
@Injectable()
export class Workspaces {
  constructor(
    @Inject(WORKSPACES_REPOSITORY)
    private readonly repository: WorkspacesRepository,
  ) {}

  /** Creates a workspace through the caller's ambient transaction. */
  create(input: {
    id: string;
    organizationId: string;
    name: string;
  }): Promise<void> {
    return this.repository.create(input);
  }

  /** Finds one operational tenant by ID, or returns `null`. */
  findById(id: string): Promise<WorkspaceSummary | null> {
    return this.repository.findById(id);
  }

  /** Batch-loads workspace summaries; absent IDs are omitted. */
  findByIds(ids: readonly string[]): Promise<WorkspaceSummary[]> {
    return this.repository.findByIds(ids);
  }
}
