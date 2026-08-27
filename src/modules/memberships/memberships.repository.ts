import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../infrastructure/database/database-context';
import type { WorkspaceRole } from '../authorization/authorization.policy';

/** Minimal active membership data shared with other Core services. */
export type MembershipSummary = {
  id: string;
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
};

/** Active membership state used for authorization and guarded writes. */
export type MembershipRecord = Readonly<{
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: Date;
}>;

/** Private repository for Membership-owned reads and writes. */
@Injectable()
export class MembershipsRepository {
  constructor(private readonly database: DatabaseContext) {}

  /** Creates the initial OWNER row under the caller's transaction context. */
  async createOwner(input: {
    id: string;
    workspaceId: string;
    userId: string;
  }): Promise<void> {
    await this.database.client.membership.create({ data: input });
  }

  /** Reactivates a removed row or creates a new invited non-owner membership. */
  async createInvited(input: {
    id: string;
    workspaceId: string;
    userId: string;
  }): Promise<void> {
    const reactivated = await this.database.client.membership.updateMany({
      where: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        removedAt: { not: null },
      },
      data: { removedAt: null },
    });
    if (reactivated.count === 1) return;

    await this.database.client.membership.create({ data: input });
  }

  /** Finds an active membership by trusted workspace and user. */
  async find(input: {
    workspaceId: string;
    userId: string;
  }): Promise<MembershipSummary | null> {
    const membership = await this.database.client.membership.findFirst({
      where: { ...input, removedAt: null },
      select: membershipWithOwnerSelect,
    });
    return membership ? toSummary(membership) : null;
  }

  /** Lists a bounded, stable-ordered set of the user's active memberships. */
  async listForUser(
    userId: string,
    limit: number,
  ): Promise<MembershipSummary[]> {
    const memberships = await this.database.client.membership.findMany({
      where: { userId, removedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit,
      select: membershipWithOwnerSelect,
    });
    return memberships.map(toSummary);
  }

  /** Finds an active target by ID within the trusted workspace. */
  async findActiveById(
    workspaceId: string,
    membershipId: string,
  ): Promise<MembershipRecord | null> {
    const membership = await this.database.client.membership.findFirst({
      where: { id: membershipId, workspaceId, removedAt: null },
      select: membershipRecordSelect,
    });
    return membership ? toRecord(membership) : null;
  }

  /** Finds an active actor membership within the trusted workspace. */
  async findActiveForUser(
    workspaceId: string,
    userId: string,
  ): Promise<MembershipRecord | null> {
    const membership = await this.database.client.membership.findFirst({
      where: { workspaceId, userId, removedAt: null },
      select: membershipRecordSelect,
    });
    return membership ? toRecord(membership) : null;
  }

  /** Lists active rows after a cursor that must belong to the same workspace. */
  async listActive(input: {
    workspaceId: string;
    cursor?: string;
    limit: number;
  }): Promise<MembershipRecord[] | null> {
    let cursor: { createdAt: Date; id: string } | undefined;
    if (input.cursor) {
      cursor =
        (await this.database.client.membership.findFirst({
          where: {
            id: input.cursor,
            workspaceId: input.workspaceId,
            removedAt: null,
          },
          select: { createdAt: true, id: true },
        })) ?? undefined;
      if (!cursor) return null;
    }

    const memberships = await this.database.client.membership.findMany({
      where: {
        workspaceId: input.workspaceId,
        removedAt: null,
        ...(cursor
          ? {
              OR: [
                { createdAt: { gt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { gt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: input.limit,
      select: membershipRecordSelect,
    });
    return memberships.map(toRecord);
  }

  /** Soft-removes a workspace-scoped membership. */
  async remove(input: {
    workspaceId: string;
    membershipId: string;
    removedAt: Date;
  }): Promise<boolean> {
    const result = await this.database.client.membership.updateMany({
      where: {
        id: input.membershipId,
        workspaceId: input.workspaceId,
        removedAt: null,
      },
      data: { removedAt: input.removedAt },
    });
    return result.count === 1;
  }
}

/** Shared Prisma projection for active membership records. */
const membershipRecordSelect = {
  id: true,
  workspaceId: true,
  userId: true,
  createdAt: true,
  workspace: { select: { ownerUserId: true } },
} as const;

const membershipWithOwnerSelect = {
  id: true,
  userId: true,
  workspaceId: true,
  workspace: { select: { ownerUserId: true } },
} as const;

function derivedRole(membership: {
  userId: string;
  workspace: { ownerUserId: string };
}): WorkspaceRole {
  return membership.workspace.ownerUserId === membership.userId
    ? 'OWNER'
    : 'MEMBER';
}

function toSummary(membership: {
  id: string;
  userId: string;
  workspaceId: string;
  workspace: { ownerUserId: string };
}): MembershipSummary {
  return {
    id: membership.id,
    userId: membership.userId,
    workspaceId: membership.workspaceId,
    role: derivedRole(membership),
  };
}

function toRecord(membership: {
  id: string;
  userId: string;
  workspaceId: string;
  createdAt: Date;
  workspace: { ownerUserId: string };
}): MembershipRecord {
  return { ...toSummary(membership), createdAt: membership.createdAt };
}
