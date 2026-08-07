import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../persistence/database-context';
import type { UserSummary, UsersRepository } from '../application/users';

@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly database: DatabaseContext) {}

  async create(input: {
    id: string;
    identityId: string;
    displayName: string;
  }): Promise<void> {
    await this.database.client.user.create({ data: input });
  }

  findById(id: string): Promise<UserSummary | null> {
    return this.database.client.user.findUnique({
      where: { id },
      select: { id: true, displayName: true },
    });
  }

  findActiveByIdentityId(identityId: string): Promise<UserSummary | null> {
    return this.database.client.user.findFirst({
      where: { identityId, status: 'ACTIVE' },
      select: { id: true, displayName: true },
    });
  }
}
