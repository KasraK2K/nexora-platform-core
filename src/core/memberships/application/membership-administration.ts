import { Inject, Injectable } from '@nestjs/common';
import type { MembershipRole } from './membership-role';

export const MEMBERSHIP_ADMINISTRATION_REPOSITORY = Symbol(
  'MEMBERSHIP_ADMINISTRATION_REPOSITORY',
);

export type MembershipAdministrationRecord = Readonly<{
  id: string;
  workspaceId: string;
  userId: string;
  role: MembershipRole;
  createdAt: Date;
}>;

export interface MembershipAdministrationRepository {
  findActiveById(
    workspaceId: string,
    membershipId: string,
  ): Promise<MembershipAdministrationRecord | null>;
  findActiveForUser(
    workspaceId: string,
    userId: string,
  ): Promise<MembershipAdministrationRecord | null>;
  listActive(input: {
    workspaceId: string;
    cursor?: string;
    limit: number;
  }): Promise<MembershipAdministrationRecord[] | null>;
  updateRole(input: {
    workspaceId: string;
    membershipId: string;
    expectedRole: MembershipRole;
    role: Exclude<MembershipRole, 'OWNER'>;
  }): Promise<boolean>;
  remove(input: {
    workspaceId: string;
    membershipId: string;
    expectedRole: Exclude<MembershipRole, 'OWNER'>;
    removedAt: Date;
  }): Promise<boolean>;
  countActiveOwners(workspaceId: string): Promise<number>;
  transferOwnership(input: {
    workspaceId: string;
    currentOwnerMembershipId: string;
    targetMembershipId: string;
    expectedTargetRole: Exclude<MembershipRole, 'OWNER'>;
  }): Promise<boolean>;
}

@Injectable()
export class MembershipAdministration {
  constructor(
    @Inject(MEMBERSHIP_ADMINISTRATION_REPOSITORY)
    private readonly repository: MembershipAdministrationRepository,
  ) {}

  findActiveById(
    workspaceId: string,
    membershipId: string,
  ): Promise<MembershipAdministrationRecord | null> {
    return this.repository.findActiveById(workspaceId, membershipId);
  }

  findActiveForUser(
    workspaceId: string,
    userId: string,
  ): Promise<MembershipAdministrationRecord | null> {
    return this.repository.findActiveForUser(workspaceId, userId);
  }

  listActive(input: {
    workspaceId: string;
    cursor?: string;
    limit: number;
  }): Promise<MembershipAdministrationRecord[] | null> {
    return this.repository.listActive(input);
  }

  updateRole(input: {
    workspaceId: string;
    membershipId: string;
    expectedRole: MembershipRole;
    role: Exclude<MembershipRole, 'OWNER'>;
  }): Promise<boolean> {
    return this.repository.updateRole(input);
  }

  remove(input: {
    workspaceId: string;
    membershipId: string;
    expectedRole: Exclude<MembershipRole, 'OWNER'>;
    removedAt: Date;
  }): Promise<boolean> {
    return this.repository.remove(input);
  }

  countActiveOwners(workspaceId: string): Promise<number> {
    return this.repository.countActiveOwners(workspaceId);
  }

  transferOwnership(input: {
    workspaceId: string;
    currentOwnerMembershipId: string;
    targetMembershipId: string;
    expectedTargetRole: Exclude<MembershipRole, 'OWNER'>;
  }): Promise<boolean> {
    return this.repository.transferOwnership(input);
  }
}
