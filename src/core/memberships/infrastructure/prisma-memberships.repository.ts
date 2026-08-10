import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../persistence/database-context';
import type {
  LoginWorkspaceResolution,
  MembershipsRepository,
  MembershipSummary,
} from '../application/memberships';

@Injectable()
export class PrismaMembershipsRepository implements MembershipsRepository {
  constructor(private readonly database: DatabaseContext) {}

  async createOwner(input: {
    id: string;
    workspaceId: string;
    userId: string;
  }): Promise<void> {
    await this.database.client.membership.create({
      data: { ...input, role: 'OWNER' },
    });
  }

  find(input: {
    workspaceId: string;
    userId: string;
  }): Promise<MembershipSummary | null> {
    return this.database.client.membership.findUnique({
      where: { workspaceId_userId: input },
      select: { userId: true, workspaceId: true, role: true },
    });
  }

  listForUser(userId: string, limit: number): Promise<MembershipSummary[]> {
    return this.database.client.membership.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit,
      select: { userId: true, workspaceId: true, role: true },
    });
  }

  async resolveLoginWorkspace(
    userId: string,
  ): Promise<LoginWorkspaceResolution> {
    const memberships = await this.database.client.membership.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 2,
      select: { userId: true, workspaceId: true, role: true },
    });

    if (memberships.length === 0) {
      return { kind: 'none' };
    }
    if (memberships.length > 1) {
      return { kind: 'ambiguous' };
    }
    return { kind: 'selected', membership: memberships[0] };
  }
}
