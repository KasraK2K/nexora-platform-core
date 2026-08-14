import { Inject, Injectable } from '@nestjs/common';
import type { InvitableMembershipRole } from './membership-role';
import {
  MEMBERSHIPS_REPOSITORY,
  type MembershipsRepository,
} from './memberships';

/** Narrow write capability used only while atomically accepting an invitation. */
@Injectable()
export class InvitedMembershipsWriter {
  constructor(
    @Inject(MEMBERSHIPS_REPOSITORY)
    private readonly repository: MembershipsRepository,
  ) {}

  /** Creates or reactivates a non-owner membership in the invitation workspace. */
  create(input: {
    id: string;
    workspaceId: string;
    userId: string;
    role: InvitableMembershipRole;
  }): Promise<void> {
    return this.repository.createInvited(input);
  }
}
