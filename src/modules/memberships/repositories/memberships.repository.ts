import type { MembershipRole } from '../domain/membership-role';

/** Injection token for the active-membership persistence boundary. */
export const MEMBERSHIPS_REPOSITORY = Symbol('MEMBERSHIPS_REPOSITORY');

/** Minimal active membership data shared with authentication and invitations. */
export type MembershipSummary = {
  userId: string;
  workspaceId: string;
  role: MembershipRole;
};

/** Persistence contract for active workspace membership state. */
export interface MembershipsRepository {
  /** Creates the initial owner membership inside the caller's transaction. */
  createOwner(input: {
    id: string;
    workspaceId: string;
    userId: string;
  }): Promise<void>;
  /** Finds one active user membership inside the trusted workspace. */
  find(input: {
    workspaceId: string;
    userId: string;
  }): Promise<MembershipSummary | null>;
  /** Creates or reactivates an invited non-owner membership transactionally. */
  createInvited(input: {
    id: string;
    workspaceId: string;
    userId: string;
    role: Exclude<MembershipRole, 'OWNER'>;
  }): Promise<void>;
  /** Lists a bounded set of active memberships for one user. */
  listForUser(userId: string, limit: number): Promise<MembershipSummary[]>;
}
