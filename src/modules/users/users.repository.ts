import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../infrastructure/database/database-context';
import { UserAlreadyExistsError } from './users.errors';
import type {
  UserAccount,
  UserCredential,
  UserStatus,
  UserSummary,
} from './users.types';

/** Private concrete repository for User account, profile, and password state. */
@Injectable()
export class UsersRepository {
  constructor(private readonly database: DatabaseContext) {}

  async create(input: {
    id: string;
    normalizedEmail: string;
    passwordHash: string;
    displayName: string;
    status: UserStatus;
  }): Promise<void> {
    try {
      await this.database.client.user.create({ data: input });
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new UserAlreadyExistsError();
      throw error;
    }
  }

  findById(id: string): Promise<UserSummary | null> {
    return this.database.client.user.findUnique({
      where: { id },
      select: { id: true, displayName: true, status: true },
    });
  }

  findAccountById(id: string): Promise<UserAccount | null> {
    return this.database.client.user.findUnique({
      where: { id },
      select: accountSelect,
    });
  }

  findByNormalizedEmail(normalizedEmail: string): Promise<UserAccount | null> {
    return this.database.client.user.findUnique({
      where: { normalizedEmail },
      select: accountSelect,
    });
  }

  findCredentialByNormalizedEmail(
    normalizedEmail: string,
  ): Promise<UserCredential | null> {
    return this.database.client.user.findUnique({
      where: { normalizedEmail },
      select: { id: true, passwordHash: true },
    });
  }

  findCredentialById(id: string): Promise<UserCredential | null> {
    return this.database.client.user.findUnique({
      where: { id },
      select: { id: true, passwordHash: true },
    });
  }

  async replacePasswordHash(
    id: string,
    passwordHash: string,
  ): Promise<boolean> {
    const result = await this.database.client.user.updateMany({
      where: { id, status: 'ACTIVE' },
      data: { passwordHash, passwordUpdatedAt: new Date() },
    });
    return result.count === 1;
  }

  async replacePasswordHashIfCurrent(input: {
    id: string;
    expectedPasswordHash: string;
    passwordHash: string;
  }): Promise<boolean> {
    const result = await this.database.client.user.updateMany({
      where: {
        id: input.id,
        passwordHash: input.expectedPasswordHash,
        status: 'ACTIVE',
      },
      data: { passwordHash: input.passwordHash, passwordUpdatedAt: new Date() },
    });
    return result.count === 1;
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

const accountSelect = {
  id: true,
  normalizedEmail: true,
  displayName: true,
  status: true,
} as const;

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
