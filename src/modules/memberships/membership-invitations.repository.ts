import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../infrastructure/database/database-context';

/** Safe invitation fields returned to services; never includes the raw token. */
export type MembershipInvitationRecord = Readonly<{
  id: string;
  workspaceId: string;
  invitedByUserId: string;
  normalizedEmail: string;
}>;

/** Private repository for hashed, workspace-scoped membership invitations. */
@Injectable()
export class MembershipInvitationsRepository {
  constructor(private readonly database: DatabaseContext) {}

  /** Persists an invitation without ever receiving or storing its raw token. */
  async create(input: {
    id: string;
    workspaceId: string;
    invitedByUserId: string;
    normalizedEmail: string;
    tokenHash: string;
    activeKey: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.database.client.membershipInvitation.create({ data: input });
  }

  /** Revokes replaceable active invitations for one workspace and email. */
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

  /** Finds a usable invitation by token hash, independent of current workspace. */
  async findUsableByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<MembershipInvitationRecord | null> {
    return this.database.client.membershipInvitation.findFirst({
      where: {
        tokenHash,
        activeKey: { not: null },
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: {
        id: true,
        workspaceId: true,
        invitedByUserId: true,
        normalizedEmail: true,
      },
    });
  }

  /** Finds a usable invitation by ID only inside the trusted workspace. */
  async findActiveById(
    workspaceId: string,
    id: string,
    now: Date,
  ): Promise<MembershipInvitationRecord | null> {
    return this.database.client.membershipInvitation.findFirst({
      where: {
        id,
        workspaceId,
        activeKey: { not: null },
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: {
        id: true,
        workspaceId: true,
        invitedByUserId: true,
        normalizedEmail: true,
      },
    });
  }

  /** Finds a usable invitation by normalized email in one workspace. */
  async findActiveForEmail(
    workspaceId: string,
    normalizedEmail: string,
    now: Date,
  ): Promise<MembershipInvitationRecord | null> {
    return this.database.client.membershipInvitation.findFirst({
      where: {
        workspaceId,
        normalizedEmail,
        activeKey: { not: null },
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: {
        id: true,
        workspaceId: true,
        invitedByUserId: true,
        normalizedEmail: true,
      },
    });
  }

  /** Compare-and-set revokes a still-active, unexpired scoped invitation. */
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

  /** Compare-and-set consumes a still-active invitation for the accepting user. */
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
}
