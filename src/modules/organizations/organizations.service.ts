import { Inject, Injectable } from '@nestjs/common';
import {
  ORGANIZATIONS_REPOSITORY,
  type OrganizationSummary,
  type OrganizationsRepository,
} from './repositories/organizations.repository';

/** Public application service for commercial organization records. */
@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(ORGANIZATIONS_REPOSITORY)
    private readonly repository: OrganizationsRepository,
  ) {}

  /** Creates a commercial organization with its initial owner. */
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
