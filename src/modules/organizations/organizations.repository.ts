import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../infrastructure/database/database-context';
import type { OrganizationSummary } from './organizations.types';

/** Private Organizations persistence service backed by DatabaseContext. */
@Injectable()
export class OrganizationsRepository {
  constructor(private readonly database: DatabaseContext) {}

  /** Persists an organization through the ambient caller-owned transaction. */
  async create(input: {
    id: string;
    ownerUserId: string;
    name: string;
  }): Promise<void> {
    await this.database.client.organization.create({ data: input });
  }

  /** Reads one commercial organization summary, or returns `null`. */
  findById(id: string): Promise<OrganizationSummary | null> {
    return this.database.client.organization.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
  }

  /** Batch-loads matching summaries and omits absent IDs. */
  findByIds(ids: readonly string[]): Promise<OrganizationSummary[]> {
    return this.database.client.organization.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, name: true },
    });
  }
}
