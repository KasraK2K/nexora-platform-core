import { Inject, Injectable } from '@nestjs/common';

export const WORKSPACES_REPOSITORY = Symbol('WORKSPACES_REPOSITORY');

export type WorkspaceSummary = {
  id: string;
  organizationId: string;
  name: string;
};

export interface WorkspacesRepository {
  create(input: {
    id: string;
    organizationId: string;
    name: string;
  }): Promise<void>;
  findById(id: string): Promise<WorkspaceSummary | null>;
  findByIds(ids: readonly string[]): Promise<WorkspaceSummary[]>;
}

@Injectable()
export class Workspaces {
  constructor(
    @Inject(WORKSPACES_REPOSITORY)
    private readonly repository: WorkspacesRepository,
  ) {}

  create(input: {
    id: string;
    organizationId: string;
    name: string;
  }): Promise<void> {
    return this.repository.create(input);
  }

  findById(id: string): Promise<WorkspaceSummary | null> {
    return this.repository.findById(id);
  }

  findByIds(ids: readonly string[]): Promise<WorkspaceSummary[]> {
    return this.repository.findByIds(ids);
  }
}
