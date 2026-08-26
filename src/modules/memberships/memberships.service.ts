import { Injectable } from '@nestjs/common';
import {
  MembershipsRepository,
  type MembershipSummary,
} from './repositories/memberships.repository';

export type { MembershipSummary } from './repositories/memberships.repository';
export type {
  InvitableMembershipRole,
  MembershipRole,
} from './membership-role';

/** Narrow public service for ordinary active-membership access. */
@Injectable()
export class MembershipsService {
  constructor(private readonly memberships: MembershipsRepository) {}

  /** Creates the initial OWNER membership inside a caller-owned transaction. */
  createOwner(input: {
    id: string;
    workspaceId: string;
    userId: string;
  }): Promise<void> {
    return this.memberships.createOwner(input);
  }

  /** Finds one active membership by trusted workspace and user identifiers. */
  find(input: {
    workspaceId: string;
    userId: string;
  }): Promise<MembershipSummary | null> {
    return this.memberships.find(input);
  }

  /** Lists a bounded set of active memberships for one user. */
  listForUser(userId: string, limit: number): Promise<MembershipSummary[]> {
    return this.memberships.listForUser(userId, limit);
  }
}
