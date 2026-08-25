import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../../infrastructure/database/database-context';
import type {
  UserAuthenticationReference,
  UserSummary,
  UsersRepository,
} from '../repositories/users.repository';

/** Prisma adapter for Users-owned profile and lifecycle rows. */
@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly database: DatabaseContext) {}

  /** Persists a user through the ambient caller-owned transaction. */
  async create(input: {
    id: string;
    identityId: string;
    displayName: string;
    status: 'PENDING_VERIFICATION' | 'ACTIVE';
  }): Promise<void> {
    await this.database.client.user.create({ data: input });
  }

  /** Reads the minimal profile view, with `null` for an absent user. */
  findById(id: string): Promise<UserSummary | null> {
    return this.database.client.user.findUnique({
      where: { id },
      select: { id: true, displayName: true, status: true },
    });
  }

  /** Reads the user-to-identity link without exposing profile data. */
  findAuthenticationReferenceById(
    id: string,
  ): Promise<UserAuthenticationReference | null> {
    return this.database.client.user.findUnique({
      where: { id },
      select: { id: true, identityId: true, status: true },
    });
  }

  /** Reads a profile by its unique identity link, or returns `null`. */
  findByIdentityId(identityId: string): Promise<UserSummary | null> {
    return this.database.client.user.findUnique({
      where: { identityId },
      select: { id: true, displayName: true, status: true },
    });
  }

  /** Reads by identity only when the user is currently active. */
  findActiveByIdentityId(identityId: string): Promise<UserSummary | null> {
    return this.database.client.user.findFirst({
      where: { identityId, status: 'ACTIVE' },
      select: { id: true, displayName: true, status: true },
    });
  }

  /** Transitions pending to active once; `false` means the precondition failed. */
  async activate(id: string): Promise<boolean> {
    const result = await this.database.client.user.updateMany({
      where: { id, status: 'PENDING_VERIFICATION' },
      data: { status: 'ACTIVE' },
    });
    return result.count === 1;
  }

  /**
   * Updates an active profile only when its prior display name still matches.
   * The boolean exposes the compare-and-swap result to the use case.
   */
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
