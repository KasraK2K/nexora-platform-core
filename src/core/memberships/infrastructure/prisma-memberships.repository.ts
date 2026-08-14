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

/** Prisma adapter for active membership reads and administration writes. */
@Injectable()
export class PrismaMembershipsRepository
  implements MembershipsRepository, MembershipAdministrationRepository
{
  constructor(private readonly database: DatabaseContext) {}

  /** Creates the initial OWNER row under the caller's transaction context. */
  async createOwner(input: {
    id: string;
    workspaceId: string;
    userId: string;
  }): Promise<void> {
    await this.database.client.membership.create({
      data: { ...input, role: 'OWNER' },
    });
  }

  /** Reactivates a removed row or creates a new invited non-owner membership. */
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

  /** Finds an active membership by trusted workspace and user. */
  find(input: {
    workspaceId: string;
    userId: string;
  }): Promise<MembershipSummary | null> {
    return this.database.client.membership.findFirst({
      where: { ...input, removedAt: null },
      select: { userId: true, workspaceId: true, role: true },
    });
  }

  /** Lists a bounded, stable-ordered set of the user's active memberships. */
  listForUser(userId: string, limit: number): Promise<MembershipSummary[]> {
    return this.database.client.membership.findMany({
      where: { userId, removedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit,
      select: { userId: true, workspaceId: true, role: true },
    });
  }

  /** Reads at most two active rows to classify login workspace selection. */
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

  /** Finds an active target by ID within the trusted workspace. */
  findActiveById(
    workspaceId: string,
    membershipId: string,
  ): Promise<MembershipAdministrationRecord | null> {
    return this.database.client.membership.findFirst({
      where: { id: membershipId, workspaceId, removedAt: null },
      select: membershipAdministrationSelect,
    });
  }

  /** Finds an active actor membership within the trusted workspace. */
  findActiveForUser(
    workspaceId: string,
    userId: string,
  ): Promise<MembershipAdministrationRecord | null> {
    return this.database.client.membership.findFirst({
      where: { workspaceId, userId, removedAt: null },
      select: membershipAdministrationSelect,
    });
  }

  /** Lists active rows after a cursor that must belong to the same workspace. */
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

  /** Updates a non-owner role with workspace, lifecycle, and expected-role guards. */
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

  /** Soft-removes a non-owner with workspace, lifecycle, and expected-role guards. */
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

  /** Counts active OWNER rows only in the supplied workspace. */
  countActiveOwners(workspaceId: string): Promise<number> {
    return this.database.client.membership.count({
      where: { workspaceId, role: 'OWNER', removedAt: null },
    });
  }

  /** Checks whether the user retains an active membership in another workspace. */
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

  /**
   * Validates both scoped rows, promotes the target, then demotes the current
   * owner. Promotion-first preserves an owner only when the caller supplies the
   * surrounding transaction required to roll back a failed demotion.
   */
  async transferOwnership(input: {
    workspaceId: string;
    currentOwnerMembershipId: string;
    targetMembershipId: string;
    expectedTargetRole: Exclude<MembershipRole, 'OWNER'>;
  }): Promise<boolean> {
    const [currentOwner, target] = await Promise.all([
      this.database.client.membership.findFirst({
        where: {
          id: input.currentOwnerMembershipId,
          workspaceId: input.workspaceId,
          role: 'OWNER',
          removedAt: null,
        },
        select: { id: true },
      }),
      this.database.client.membership.findFirst({
        where: {
          id: input.targetMembershipId,
          workspaceId: input.workspaceId,
          role: input.expectedTargetRole,
          removedAt: null,
        },
        select: { id: true },
      }),
    ]);
    if (!currentOwner || !target) return false;

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

/** Shared Prisma projection for active membership administration records. */
const membershipAdministrationSelect = {
  id: true,
  workspaceId: true,
  userId: true,
  role: true,
  createdAt: true,
} as const;
