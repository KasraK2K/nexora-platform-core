import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../persistence/database-context';
import type {
  UserAuthenticationReference,
  UserSummary,
  UsersRepository,
} from '../application/users';

@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly database: DatabaseContext) {}

  async create(input: {
    id: string;
    identityId: string;
    displayName: string;
    status: 'PENDING_VERIFICATION' | 'ACTIVE';
  }): Promise<void> {
    await this.database.client.user.create({ data: input });
  }

  findById(id: string): Promise<UserSummary | null> {
    return this.database.client.user.findUnique({
      where: { id },
      select: { id: true, displayName: true, status: true },
    });
  }

  findAuthenticationReferenceById(
    id: string,
  ): Promise<UserAuthenticationReference | null> {
    return this.database.client.user.findUnique({
      where: { id },
      select: { id: true, identityId: true, status: true },
    });
  }

  findByIdentityId(identityId: string): Promise<UserSummary | null> {
    return this.database.client.user.findUnique({
      where: { identityId },
      select: { id: true, displayName: true, status: true },
    });
  }

  findActiveByIdentityId(identityId: string): Promise<UserSummary | null> {
    return this.database.client.user.findFirst({
      where: { identityId, status: 'ACTIVE' },
      select: { id: true, displayName: true, status: true },
    });
  }

  async activate(id: string): Promise<boolean> {
    const result = await this.database.client.user.updateMany({
      where: { id, status: 'PENDING_VERIFICATION' },
      data: { status: 'ACTIVE' },
    });
    return result.count === 1;
  }

  async updateDisplayName(input: {
    id: string;
    expectedDisplayName: string;
    displayName: string;
  }): Promise<boolean> {
    const result = await this.database.client.user.updateMany({
      where: {
        id: input.id,
        status: 'ACTIVE',
        displayName: input.expectedDisplayName,
      },
      data: { displayName: input.displayName },
    });
    return result.count === 1;
  }
}
