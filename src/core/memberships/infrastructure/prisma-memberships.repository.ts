import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../persistence/database-context';
import type {
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
}
