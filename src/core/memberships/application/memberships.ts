import { Inject, Injectable } from '@nestjs/common';

export const MEMBERSHIPS_REPOSITORY = Symbol('MEMBERSHIPS_REPOSITORY');

export type MembershipSummary = {
  userId: string;
  workspaceId: string;
  role: 'OWNER';
};

export interface MembershipsRepository {
  createOwner(input: {
    id: string;
    workspaceId: string;
    userId: string;
  }): Promise<void>;
  find(input: {
    workspaceId: string;
    userId: string;
  }): Promise<MembershipSummary | null>;
}

@Injectable()
export class Memberships {
  constructor(
    @Inject(MEMBERSHIPS_REPOSITORY)
    private readonly repository: MembershipsRepository,
  ) {}

  createOwner(input: {
    id: string;
    workspaceId: string;
    userId: string;
  }): Promise<void> {
    return this.repository.createOwner(input);
  }

  find(input: {
    workspaceId: string;
    userId: string;
  }): Promise<MembershipSummary | null> {
    return this.repository.find(input);
  }
}
