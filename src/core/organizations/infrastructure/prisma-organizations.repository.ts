import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../persistence/database-context';
import type {
  OrganizationSummary,
  OrganizationsRepository,
} from '../application/organizations';

@Injectable()
export class PrismaOrganizationsRepository implements OrganizationsRepository {
  constructor(private readonly database: DatabaseContext) {}

  async create(input: {
    id: string;
    ownerUserId: string;
    name: string;
  }): Promise<void> {
    await this.database.client.organization.create({ data: input });
  }

  findById(id: string): Promise<OrganizationSummary | null> {
    return this.database.client.organization.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
  }
}
