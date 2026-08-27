import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../infrastructure/database/database-context';
import type { WorkspaceSummary } from './workspaces.types';

/** Private Workspaces persistence service backed by DatabaseContext. */
@Injectable()
export class WorkspacesRepository {
  constructor(private readonly database: DatabaseContext) {}

  /** Persists a workspace through the ambient caller-owned transaction. */
  async create(input: {
    id: string;
    ownerUserId: string;
    name: string;
  }): Promise<void> {
    await this.database.client.workspace.create({ data: input });
  }

  /** Reads one workspace summary, with `null` for an absent ID. */
  findById(id: string): Promise<WorkspaceSummary | null> {
    return this.database.client.workspace.findUnique({
      where: { id },
      select: { id: true, ownerUserId: true, name: true },
    });
  }

  /** Batch-loads matching workspace summaries and omits absent IDs. */
  findByIds(ids: readonly string[]): Promise<WorkspaceSummary[]> {
    return this.database.client.workspace.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, ownerUserId: true, name: true },
    });
  }

  /** Compare-and-set renames one owner-scoped workspace. */
  async rename(input: {
    id: string;
    ownerUserId: string;
    expectedName: string;
    name: string;
  }): Promise<boolean> {
    const result = await this.database.client.workspace.updateMany({
      where: {
        id: input.id,
        ownerUserId: input.ownerUserId,
        name: input.expectedName,
      },
      data: { name: input.name },
    });
    return result.count === 1;
  }
}
