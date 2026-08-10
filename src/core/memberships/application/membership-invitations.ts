import { Inject, Injectable } from '@nestjs/common';
import type { InvitableMembershipRole } from './membership-role';

export const MEMBERSHIP_INVITATIONS_REPOSITORY = Symbol(
  'MEMBERSHIP_INVITATIONS_REPOSITORY',
);

export type MembershipInvitationRecord = Readonly<{
  id: string;
  workspaceId: string;
  invitedByUserId: string;
  normalizedEmail: string;
  role: InvitableMembershipRole;
}>;

export interface MembershipInvitationsRepository {
  create(input: {
    id: string;
    workspaceId: string;
    invitedByUserId: string;
    normalizedEmail: string;
    role: InvitableMembershipRole;
    tokenHash: string;
    activeKey: string;
    expiresAt: Date;
  }): Promise<void>;
  retireActive(
    workspaceId: string,
    normalizedEmail: string,
    revokedAt: Date,
  ): Promise<void>;
  findUsableByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<MembershipInvitationRecord | null>;
  findActiveById(
    workspaceId: string,
    id: string,
    now: Date,
  ): Promise<MembershipInvitationRecord | null>;
  findActiveForEmail(
    workspaceId: string,
    normalizedEmail: string,
    now: Date,
  ): Promise<MembershipInvitationRecord | null>;
  revoke(workspaceId: string, id: string, revokedAt: Date): Promise<boolean>;
  accept(
    workspaceId: string,
    id: string,
    acceptedByUserId: string,
    acceptedAt: Date,
  ): Promise<boolean>;
  markDelivery(
    workspaceId: string,
    id: string,
    status: 'SENT' | 'FAILED',
    attemptedAt: Date,
  ): Promise<void>;
}

@Injectable()
export class MembershipInvitations {
  constructor(
    @Inject(MEMBERSHIP_INVITATIONS_REPOSITORY)
    private readonly repository: MembershipInvitationsRepository,
  ) {}

  create(
    input: Parameters<MembershipInvitationsRepository['create']>[0],
  ): Promise<void> {
    return this.repository.create(input);
  }

  retireActive(
    workspaceId: string,
    normalizedEmail: string,
    revokedAt: Date,
  ): Promise<void> {
    return this.repository.retireActive(
      workspaceId,
      normalizedEmail,
      revokedAt,
    );
  }

  findUsableByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<MembershipInvitationRecord | null> {
    return this.repository.findUsableByTokenHash(tokenHash, now);
  }

  findActiveById(
    workspaceId: string,
    id: string,
    now: Date,
  ): Promise<MembershipInvitationRecord | null> {
    return this.repository.findActiveById(workspaceId, id, now);
  }

  findActiveForEmail(
    workspaceId: string,
    normalizedEmail: string,
    now: Date,
  ): Promise<MembershipInvitationRecord | null> {
    return this.repository.findActiveForEmail(
      workspaceId,
      normalizedEmail,
      now,
    );
  }

  revoke(workspaceId: string, id: string, revokedAt: Date): Promise<boolean> {
    return this.repository.revoke(workspaceId, id, revokedAt);
  }

  accept(
    workspaceId: string,
    id: string,
    acceptedByUserId: string,
    acceptedAt: Date,
  ): Promise<boolean> {
    return this.repository.accept(
      workspaceId,
      id,
      acceptedByUserId,
      acceptedAt,
    );
  }

  markDelivery(
    workspaceId: string,
    id: string,
    status: 'SENT' | 'FAILED',
    attemptedAt: Date,
  ): Promise<void> {
    return this.repository.markDelivery(workspaceId, id, status, attemptedAt);
  }
}
