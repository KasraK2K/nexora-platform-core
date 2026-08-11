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

  findByIds(ids: readonly string[]): Promise<WorkspaceSummary[]> {
    return this.database.client.workspace.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, organizationId: true, name: true },
    });
  }

  async rename(input: {
    id: string;
    organizationId: string;
    expectedName: string;
    name: string;
  }): Promise<boolean> {
    const result = await this.database.client.workspace.updateMany({
      where: {
        id: input.id,
        organizationId: input.organizationId,
        name: input.expectedName,
      },
      data: { name: input.name },
    });
    return result.count === 1;
  }
}
