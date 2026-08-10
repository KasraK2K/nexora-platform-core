import { Inject, Injectable } from '@nestjs/common';

export const ORGANIZATIONS_REPOSITORY = Symbol('ORGANIZATIONS_REPOSITORY');

export type OrganizationSummary = { id: string; name: string };

export interface OrganizationsRepository {
  create(input: {
    id: string;
    ownerUserId: string;
    name: string;
  }): Promise<void>;
  findById(id: string): Promise<OrganizationSummary | null>;
  findByIds(ids: readonly string[]): Promise<OrganizationSummary[]>;
}

@Injectable()
export class Organizations {
  constructor(
    @Inject(ORGANIZATIONS_REPOSITORY)
    private readonly repository: OrganizationsRepository,
  ) {}

  create(input: {
    id: string;
    ownerUserId: string;
    name: string;
  }): Promise<void> {
    return this.repository.create(input);
  }

  findById(id: string): Promise<OrganizationSummary | null> {
    return this.repository.findById(id);
  }

  findByIds(ids: readonly string[]): Promise<OrganizationSummary[]> {
    return this.repository.findByIds(ids);
  }
}
