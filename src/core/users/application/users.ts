import { Inject, Injectable } from '@nestjs/common';

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE';
export type UserSummary = {
  id: string;
  displayName: string;
  status: UserStatus;
};

export type UserAuthenticationReference = {
  id: string;
  identityId: string;
  status: UserStatus;
};

export interface UsersRepository {
  create(input: {
    id: string;
    identityId: string;
    displayName: string;
    status: UserStatus;
  }): Promise<void>;
  findById(id: string): Promise<UserSummary | null>;
  findAuthenticationReferenceById(
    id: string,
  ): Promise<UserAuthenticationReference | null>;
  findByIdentityId(identityId: string): Promise<UserSummary | null>;
  findActiveByIdentityId(identityId: string): Promise<UserSummary | null>;
  activate(id: string): Promise<boolean>;
  updateDisplayName(input: {
    id: string;
    expectedDisplayName: string;
    displayName: string;
  }): Promise<boolean>;
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
    status: UserStatus;
  }): Promise<void> {
    return this.repository.create(input);
  }

  findById(id: string): Promise<UserSummary | null> {
    return this.repository.findById(id);
  }

  findAuthenticationReferenceById(
    id: string,
  ): Promise<UserAuthenticationReference | null> {
    return this.repository.findAuthenticationReferenceById(id);
  }

  findByIdentityId(identityId: string): Promise<UserSummary | null> {
    return this.repository.findByIdentityId(identityId);
  }

  findActiveByIdentityId(identityId: string): Promise<UserSummary | null> {
    return this.repository.findActiveByIdentityId(identityId);
  }

  activate(id: string): Promise<boolean> {
    return this.repository.activate(id);
  }
}
