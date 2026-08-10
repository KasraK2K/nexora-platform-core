import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../persistence/database-context';
import type {
  MembershipInvitationRecord,
  MembershipInvitationsRepository,
} from '../application/membership-invitations';
import {
  isInvitableMembershipRole,
  type InvitableMembershipRole,
} from '../application/membership-role';

@Injectable()
export class PrismaMembershipInvitationsRepository implements MembershipInvitationsRepository {
  constructor(private readonly database: DatabaseContext) {}

  async create(input: {
    id: string;
    workspaceId: string;
    invitedByUserId: string;
    normalizedEmail: string;
    role: InvitableMembershipRole;
    tokenHash: string;
    activeKey: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.database.client.membershipInvitation.create({ data: input });
  }

  async retireActive(
    workspaceId: string,
    normalizedEmail: string,
    revokedAt: Date,
  ): Promise<void> {
    await this.database.client.membershipInvitation.updateMany({
      where: {
        workspaceId,
        normalizedEmail,
        activeKey: { not: null },
        acceptedAt: null,
        revokedAt: null,
      },
      data: { activeKey: null, revokedAt },
    });
  }

  async findUsableByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<MembershipInvitationRecord | null> {
    const invitation =
      await this.database.client.membershipInvitation.findFirst({
        where: {
          tokenHash,
          activeKey: { not: null },
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
          role: { in: ['ADMIN', 'MEMBER'] },
        },
        select: {
          id: true,
          workspaceId: true,
          invitedByUserId: true,
          normalizedEmail: true,
          role: true,
        },
      });
    const role = invitation?.role;
    if (!invitation || !isInvitableMembershipRole(role)) {
      return null;
    }
    return { ...invitation, role };
  }

  async findActiveById(
    workspaceId: string,
    id: string,
    now: Date,
  ): Promise<MembershipInvitationRecord | null> {
    const invitation =
      await this.database.client.membershipInvitation.findFirst({
        where: {
          id,
          workspaceId,
          activeKey: { not: null },
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
          role: { in: ['ADMIN', 'MEMBER'] },
        },
        select: {
          id: true,
          workspaceId: true,
          invitedByUserId: true,
          normalizedEmail: true,
          role: true,
        },
      });
    const role = invitation?.role;
    if (!invitation || !isInvitableMembershipRole(role)) {
      return null;
    }
    return { ...invitation, role };
  }

  async findActiveForEmail(
    workspaceId: string,
    normalizedEmail: string,
    now: Date,
  ): Promise<MembershipInvitationRecord | null> {
    const invitation =
      await this.database.client.membershipInvitation.findFirst({
        where: {
          workspaceId,
          normalizedEmail,
          activeKey: { not: null },
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
          role: { in: ['ADMIN', 'MEMBER'] },
        },
        select: {
          id: true,
          workspaceId: true,
          invitedByUserId: true,
          normalizedEmail: true,
          role: true,
        },
      });
    const role = invitation?.role;
    if (!invitation || !isInvitableMembershipRole(role)) {
      return null;
    }
    return { ...invitation, role };
  }

  async revoke(
    workspaceId: string,
    id: string,
    revokedAt: Date,
  ): Promise<boolean> {
    const result = await this.database.client.membershipInvitation.updateMany({
      where: {
        id,
        workspaceId,
        activeKey: { not: null },
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: revokedAt },
      },
      data: { activeKey: null, revokedAt },
    });
    return result.count === 1;
  }

  async accept(
    workspaceId: string,
    id: string,
    acceptedByUserId: string,
    acceptedAt: Date,
  ): Promise<boolean> {
    const result = await this.database.client.membershipInvitation.updateMany({
      where: {
        id,
        workspaceId,
        activeKey: { not: null },
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: acceptedAt },
      },
      data: { activeKey: null, acceptedAt, acceptedByUserId },
    });
    return result.count === 1;
  }

  async markDelivery(
    workspaceId: string,
    id: string,
    status: 'SENT' | 'FAILED',
    attemptedAt: Date,
  ): Promise<void> {
    await this.database.client.membershipInvitation.updateMany({
      where: { id, workspaceId },
      data: { deliveryStatus: status, deliveryAttemptedAt: attemptedAt },
    });
  }
}
