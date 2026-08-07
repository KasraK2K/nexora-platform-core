import { Inject, Injectable } from '@nestjs/common';

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

export type UserSummary = { id: string; displayName: string };

export interface UsersRepository {
  create(input: {
    id: string;
    identityId: string;
    displayName: string;
  }): Promise<void>;
  findById(id: string): Promise<UserSummary | null>;
  findActiveByIdentityId(identityId: string): Promise<UserSummary | null>;
}

@Injectable()
export class Users {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly repository: UsersRepository,
  ) {}

  create(input: {
    id: string;
    identityId: string;
    displayName: string;
  }): Promise<void> {
    return this.repository.create(input);
  }

  findById(id: string): Promise<UserSummary | null> {
    return this.repository.findById(id);
  }

  findActiveByIdentityId(identityId: string): Promise<UserSummary | null> {
    return this.repository.findActiveByIdentityId(identityId);
  }
}
