import { Inject, Injectable } from '@nestjs/common';

export const MEMBERSHIPS_REPOSITORY = Symbol('MEMBERSHIPS_REPOSITORY');

export type MembershipSummary = {
  userId: string;
  workspaceId: string;
  role: 'OWNER';
};

export type LoginWorkspaceResolution =
  | { kind: 'selected'; membership: MembershipSummary }
  | { kind: 'none' }
  | { kind: 'ambiguous' };

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
  listForUser(userId: string, limit: number): Promise<MembershipSummary[]>;
  resolveLoginWorkspace(userId: string): Promise<LoginWorkspaceResolution>;
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

  listForUser(userId: string, limit: number): Promise<MembershipSummary[]> {
    return this.repository.listForUser(userId, limit);
  }

  resolveLoginWorkspace(userId: string): Promise<LoginWorkspaceResolution> {
    return this.repository.resolveLoginWorkspace(userId);
  }
}
