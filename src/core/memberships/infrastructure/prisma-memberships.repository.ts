import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../persistence/database-context';
import type {
  LoginWorkspaceResolution,
  MembershipsRepository,
  MembershipSummary,
} from '../application/memberships';
import type { MembershipRole } from '../application/membership-role';
import type {
  MembershipAdministrationRecord,
  MembershipAdministrationRepository,
} from '../application/membership-administration';

@Injectable()
export class PrismaMembershipsRepository
  implements MembershipsRepository, MembershipAdministrationRepository
{
  constructor(private readonly database: DatabaseContext) {}

  async createOwner(input: {
    id: string;
    workspaceId: string;
    userId: string;
  }): Promise<void> {
    await this.database.client.membership.create({
      data: { ...input, role: 'OWNER' },
    });
  }

  async createInvited(input: {
    id: string;
    workspaceId: string;
    userId: string;
    role: Exclude<MembershipRole, 'OWNER'>;
  }): Promise<void> {
    const reactivated = await this.database.client.membership.updateMany({
      where: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        removedAt: { not: null },
      },
      data: { role: input.role, removedAt: null },
    });
    if (reactivated.count === 1) return;

    await this.database.client.membership.create({ data: input });
  }

  find(input: {
    workspaceId: string;
    userId: string;
  }): Promise<MembershipSummary | null> {
    return this.database.client.membership.findFirst({
      where: { ...input, removedAt: null },
      select: { userId: true, workspaceId: true, role: true },
    });
  }

  listForUser(userId: string, limit: number): Promise<MembershipSummary[]> {
    return this.database.client.membership.findMany({
      where: { userId, removedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit,
      select: { userId: true, workspaceId: true, role: true },
    });
  }

  async resolveLoginWorkspace(
    userId: string,
  ): Promise<LoginWorkspaceResolution> {
    const memberships = await this.database.client.membership.findMany({
      where: { userId, removedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 2,
      select: { userId: true, workspaceId: true, role: true },
    });

    if (memberships.length === 0) {
      return { kind: 'none' };
    }
    if (memberships.length > 1) {
      return { kind: 'ambiguous' };
    }
    return { kind: 'selected', membership: memberships[0] };
  }

  findActiveById(
    workspaceId: string,
    membershipId: string,
  ): Promise<MembershipAdministrationRecord | null> {
    return this.database.client.membership.findFirst({
      where: { id: membershipId, workspaceId, removedAt: null },
      select: membershipAdministrationSelect,
    });
  }

  findActiveForUser(
    workspaceId: string,
    userId: string,
  ): Promise<MembershipAdministrationRecord | null> {
    return this.database.client.membership.findFirst({
      where: { workspaceId, userId, removedAt: null },
      select: membershipAdministrationSelect,
    });
  }

  async listActive(input: {
    workspaceId: string;
    cursor?: string;
    limit: number;
  }): Promise<MembershipAdministrationRecord[] | null> {
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

    return this.database.client.membership.findMany({
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
      select: membershipAdministrationSelect,
    });
  }

  async updateRole(input: {
    workspaceId: string;
    membershipId: string;
    expectedRole: MembershipRole;
    role: Exclude<MembershipRole, 'OWNER'>;
  }): Promise<boolean> {
    const result = await this.database.client.membership.updateMany({
      where: {
        id: input.membershipId,
        workspaceId: input.workspaceId,
        role: input.expectedRole,
        removedAt: null,
      },
      data: { role: input.role },
    });
    return result.count === 1;
  }

  async remove(input: {
    workspaceId: string;
    membershipId: string;
    expectedRole: Exclude<MembershipRole, 'OWNER'>;
    removedAt: Date;
  }): Promise<boolean> {
    const result = await this.database.client.membership.updateMany({
      where: {
        id: input.membershipId,
        workspaceId: input.workspaceId,
        role: input.expectedRole,
        removedAt: null,
      },
      data: { removedAt: input.removedAt },
    });
    return result.count === 1;
  }

  countActiveOwners(workspaceId: string): Promise<number> {
    return this.database.client.membership.count({
      where: { workspaceId, role: 'OWNER', removedAt: null },
    });
  }

  async hasOtherActiveForUser(
    userId: string,
    excludingWorkspaceId: string,
  ): Promise<boolean> {
    return (
      (await this.database.client.membership.count({
        where: {
          userId,
          workspaceId: { not: excludingWorkspaceId },
          removedAt: null,
        },
      })) > 0
    );
  }

  async transferOwnership(input: {
    workspaceId: string;
    currentOwnerMembershipId: string;
    targetMembershipId: string;
    expectedTargetRole: Exclude<MembershipRole, 'OWNER'>;
  }): Promise<boolean> {
    const promoted = await this.database.client.membership.updateMany({
      where: {
        id: input.targetMembershipId,
        workspaceId: input.workspaceId,
        role: input.expectedTargetRole,
        removedAt: null,
      },
      data: { role: 'OWNER' },
    });
    if (promoted.count !== 1) return false;

    const demoted = await this.database.client.membership.updateMany({
      where: {
        id: input.currentOwnerMembershipId,
        workspaceId: input.workspaceId,
        role: 'OWNER',
        removedAt: null,
      },
      data: { role: 'ADMIN' },
    });
    return demoted.count === 1;
  }
}

const membershipAdministrationSelect = {
  id: true,
  workspaceId: true,
  userId: true,
  role: true,
  createdAt: true,
} as const;
