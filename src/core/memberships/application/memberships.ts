import { Inject, Injectable } from '@nestjs/common';
import type { MembershipRole } from './membership-role';

/** Injection token for the active-membership persistence boundary. */
export const MEMBERSHIPS_REPOSITORY = Symbol('MEMBERSHIPS_REPOSITORY');

/** Minimal active membership data shared with authentication and invitations. */
export type MembershipSummary = {
  userId: string;
  workspaceId: string;
  role: MembershipRole;
};

/**
 * Persistence contract for active workspace membership lookups and creation.
 * Implementations must exclude soft-removed rows from every read.
 */
export interface MembershipsRepository {
  /** Creates the initial owner membership inside the caller's transaction. */
  createOwner(input: {
    id: string;
    workspaceId: string;
    userId: string;
  }): Promise<void>;
  /** Finds one active user membership within the supplied trusted workspace. */
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
  /** Lists a bounded set of the user's active workspace memberships. */
  listForUser(userId: string, limit: number): Promise<MembershipSummary[]>;
}

/** Public application facade for active membership capabilities. */
@Injectable()
export class Memberships {
  constructor(
    @Inject(MEMBERSHIPS_REPOSITORY)
    private readonly repository: MembershipsRepository,
  ) {}

  /** Creates the initial owner membership under the caller's transaction. */
  createOwner(input: {
    id: string;
    workspaceId: string;
    userId: string;
  }): Promise<void> {
    return this.repository.createOwner(input);
  }

  /** Returns the user's active membership in the trusted workspace, if any. */
  find(input: {
    workspaceId: string;
    userId: string;
  }): Promise<MembershipSummary | null> {
    return this.repository.find(input);
  }

  /** Lists up to `limit` active memberships for an authenticated user. */
  listForUser(userId: string, limit: number): Promise<MembershipSummary[]> {
    return this.repository.listForUser(userId, limit);
  }
}
