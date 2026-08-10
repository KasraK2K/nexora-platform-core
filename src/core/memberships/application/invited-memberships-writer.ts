import { Inject, Injectable } from '@nestjs/common';
import type { InvitableMembershipRole } from './membership-role';
import {
  MEMBERSHIPS_REPOSITORY,
  type MembershipsRepository,
} from './memberships';

@Injectable()
export class InvitedMembershipsWriter {
  constructor(
    @Inject(MEMBERSHIPS_REPOSITORY)
    private readonly repository: MembershipsRepository,
  ) {}

  create(input: {
    id: string;
    workspaceId: string;
    userId: string;
    role: InvitableMembershipRole;
  }): Promise<void> {
    return this.repository.createInvited(input);
  }
}
