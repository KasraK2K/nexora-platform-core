import { Inject, Injectable } from '@nestjs/common';
import type { MembershipRole } from './membership-role';

/** Injection token for workspace-scoped membership administration persistence. */
export const MEMBERSHIP_ADMINISTRATION_REPOSITORY = Symbol(
  'MEMBERSHIP_ADMINISTRATION_REPOSITORY',
);

/** Active membership state used for authorization and compare-and-set writes. */
export type MembershipAdministrationRecord = Readonly<{
  id: string;
  workspaceId: string;
  userId: string;
  role: MembershipRole;
  createdAt: Date;
}>;

/**
 * Persistence contract for active, workspace-scoped membership administration.
 * Mutations return `false` when authoritative state changed before the write.
 */
export interface MembershipAdministrationRepository {
  /** Finds an active target by ID only inside the trusted workspace. */
  findActiveById(
    workspaceId: string,
    membershipId: string,
  ): Promise<MembershipAdministrationRecord | null>;
  /** Finds an active actor membership inside the trusted workspace. */
  findActiveForUser(
    workspaceId: string,
    userId: string,
  ): Promise<MembershipAdministrationRecord | null>;
  /** Lists active rows after a workspace-scoped cursor, or `null` if invalid. */
  listActive(input: {
    workspaceId: string;
    cursor?: string;
    limit: number;
  }): Promise<MembershipAdministrationRecord[] | null>;
  /** Changes a non-owner role only when the expected active role still matches. */
  updateRole(input: {
    workspaceId: string;
    membershipId: string;
    expectedRole: MembershipRole;
    role: Exclude<MembershipRole, 'OWNER'>;
  }): Promise<boolean>;
  /** Soft-removes a non-owner row only when its expected role still matches. */
  remove(input: {
    workspaceId: string;
    membershipId: string;
    expectedRole: Exclude<MembershipRole, 'OWNER'>;
    removedAt: Date;
  }): Promise<boolean>;
  /** Counts current owners in one trusted workspace. */
  countActiveOwners(workspaceId: string): Promise<number>;

  /** Checks whether self-leave would preserve another active workspace. */
  hasOtherActiveForUser(
    userId: string,
    excludingWorkspaceId: string,
  ): Promise<boolean>;
  /**
   * Promotes the target before demoting the current owner.
   * This ordering is safe only inside the transaction supplied by the use case.
   */
  transferOwnership(input: {
    workspaceId: string;
    currentOwnerMembershipId: string;
    targetMembershipId: string;
    expectedTargetRole: Exclude<MembershipRole, 'OWNER'>;
  }): Promise<boolean>;
}

/** Public application facade for workspace membership administration. */
@Injectable()
export class MembershipAdministration {
  constructor(
    @Inject(MEMBERSHIP_ADMINISTRATION_REPOSITORY)
    private readonly repository: MembershipAdministrationRepository,
  ) {}

  /** Finds an active target by ID within the trusted workspace. */
  findActiveById(
    workspaceId: string,
    membershipId: string,
  ): Promise<MembershipAdministrationRecord | null> {
    return this.repository.findActiveById(workspaceId, membershipId);
  }

  /** Finds the actor's active membership within the trusted workspace. */
  findActiveForUser(
    workspaceId: string,
    userId: string,
  ): Promise<MembershipAdministrationRecord | null> {
    return this.repository.findActiveForUser(workspaceId, userId);
  }

  /** Lists a bounded active page, preserving invalid-cursor signaling. */
  listActive(input: {
    workspaceId: string;
    cursor?: string;
    limit: number;
  }): Promise<MembershipAdministrationRecord[] | null> {
    return this.repository.listActive(input);
  }

  /** Performs an expected-role compare-and-set update. */
  updateRole(input: {
    workspaceId: string;
    membershipId: string;
    expectedRole: MembershipRole;
    role: Exclude<MembershipRole, 'OWNER'>;
  }): Promise<boolean> {
    return this.repository.updateRole(input);
  }

  /** Soft-removes a non-owner membership with an expected-role guard. */
  remove(input: {
    workspaceId: string;
    membershipId: string;
    expectedRole: Exclude<MembershipRole, 'OWNER'>;
    removedAt: Date;
  }): Promise<boolean> {
    return this.repository.remove(input);
  }

  /** Counts active owners in the supplied trusted workspace. */
  countActiveOwners(workspaceId: string): Promise<number> {
    return this.repository.countActiveOwners(workspaceId);
  }

  /** Checks for another active workspace before self-service leave. */
  hasOtherActiveForUser(
    userId: string,
    excludingWorkspaceId: string,
  ): Promise<boolean> {
    return this.repository.hasOtherActiveForUser(userId, excludingWorkspaceId);
  }

  /**
   * Replaces the operational owner through the repository's compound write.
   * The caller remains responsible for wrapping this method in a transaction.
   */
  transferOwnership(input: {
    workspaceId: string;
    currentOwnerMembershipId: string;
    targetMembershipId: string;
    expectedTargetRole: Exclude<MembershipRole, 'OWNER'>;
  }): Promise<boolean> {
    return this.repository.transferOwnership(input);
  }
}
