import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../persistence/database-context';
import type {
  WorkspaceSummary,
  WorkspacesRepository,
} from '../application/workspaces';

@Injectable()
export class PrismaWorkspacesRepository implements WorkspacesRepository {
  constructor(private readonly database: DatabaseContext) {}

  async create(input: {
    id: string;
    organizationId: string;
    name: string;
  }): Promise<void> {
    await this.database.client.workspace.create({ data: input });
  }

  findById(id: string): Promise<WorkspaceSummary | null> {
    return this.database.client.workspace.findUnique({
      where: { id },
      select: { id: true, organizationId: true, name: true },
    });
  }
}
