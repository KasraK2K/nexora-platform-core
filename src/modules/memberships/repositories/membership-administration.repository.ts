import type { MembershipRole } from '../domain/membership-role';

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

/** Persistence contract for active, workspace-scoped membership administration. */
export interface MembershipAdministrationRepository {
  /** Finds an active target by ID only inside the trusted workspace. */
  findActiveById(
    workspaceId: string,
    membershipId: string,
  ): Promise<MembershipAdministrationRecord | null>;
  /** Finds the actor's active membership inside the trusted workspace. */
  findActiveForUser(
    workspaceId: string,
    userId: string,
  ): Promise<MembershipAdministrationRecord | null>;
  /** Lists active rows after a workspace-scoped cursor, or null if invalid. */
  listActive(input: {
    workspaceId: string;
    cursor?: string;
    limit: number;
  }): Promise<MembershipAdministrationRecord[] | null>;
  /** Changes a non-owner role when the expected active role still matches. */
  updateRole(input: {
    workspaceId: string;
    membershipId: string;
    expectedRole: MembershipRole;
    role: Exclude<MembershipRole, 'OWNER'>;
  }): Promise<boolean>;
  /** Soft-removes a non-owner row when its expected role still matches. */
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
  /** Promotes the target and demotes the current owner in one compound write. */
  transferOwnership(input: {
    workspaceId: string;
    currentOwnerMembershipId: string;
    targetMembershipId: string;
    expectedTargetRole: Exclude<MembershipRole, 'OWNER'>;
  }): Promise<boolean>;
}
