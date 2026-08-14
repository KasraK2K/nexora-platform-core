import { Inject, Injectable } from '@nestjs/common';
import type { InvitableMembershipRole } from './membership-role';

/** Injection token for invitation persistence. */
export const MEMBERSHIP_INVITATIONS_REPOSITORY = Symbol(
  'MEMBERSHIP_INVITATIONS_REPOSITORY',
);

/** Safe invitation fields returned to application use cases; no raw token. */
export type MembershipInvitationRecord = Readonly<{
  id: string;
  workspaceId: string;
  invitedByUserId: string;
  normalizedEmail: string;
  role: InvitableMembershipRole;
}>;

/**
 * Persistence contract for hashed, email-bound membership invitations.
 * Workspace-scoped terminal writes use compare-and-set conditions for races.
 */
export interface MembershipInvitationsRepository {
  /** Creates an invitation containing only the token hash and active key. */
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
  /** Revokes any replaceable active invitation for this workspace and email. */
  retireActive(
    workspaceId: string,
    normalizedEmail: string,
    revokedAt: Date,
  ): Promise<void>;
  /** Resolves an unexpired invitation by token hash for email-bound acceptance. */
  findUsableByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<MembershipInvitationRecord | null>;
  /** Finds an active invitation by ID inside the trusted workspace. */
  findActiveById(
    workspaceId: string,
    id: string,
    now: Date,
  ): Promise<MembershipInvitationRecord | null>;
  /** Finds an active invitation for a normalized email in one workspace. */
  findActiveForEmail(
    workspaceId: string,
    normalizedEmail: string,
    now: Date,
  ): Promise<MembershipInvitationRecord | null>;
  /** Atomically revokes a still-active workspace-scoped invitation. */
  revoke(workspaceId: string, id: string, revokedAt: Date): Promise<boolean>;

  /** Atomically consumes a still-active invitation for the accepting user. */
  accept(
    workspaceId: string,
    id: string,
    acceptedByUserId: string,
    acceptedAt: Date,
  ): Promise<boolean>;
  /** Records coarse post-commit delivery status without exposing mail content. */
  markDelivery(
    workspaceId: string,
    id: string,
    status: 'SENT' | 'FAILED',
    attemptedAt: Date,
  ): Promise<void>;
}

/** Public application facade for invitation persistence operations. */
@Injectable()
export class MembershipInvitations {
  constructor(
    @Inject(MEMBERSHIP_INVITATIONS_REPOSITORY)
    private readonly repository: MembershipInvitationsRepository,
  ) {}

  /** Persists an invitation under the transaction owned by the caller. */
  create(
    input: Parameters<MembershipInvitationsRepository['create']>[0],
  ): Promise<void> {
    return this.repository.create(input);
  }

  /** Retires a prior active invitation before its replacement is created. */
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

  /** Looks up an unexpired invitation using only a hashed token. */
  findUsableByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<MembershipInvitationRecord | null> {
    return this.repository.findUsableByTokenHash(tokenHash, now);
  }

  /** Looks up an active invitation by trusted workspace and ID. */
  findActiveById(
    workspaceId: string,
    id: string,
    now: Date,
  ): Promise<MembershipInvitationRecord | null> {
    return this.repository.findActiveById(workspaceId, id, now);
  }

  /** Looks up an active invitation by trusted workspace and normalized email. */
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

  /** Revokes an invitation if it remains active in the trusted workspace. */
  revoke(workspaceId: string, id: string, revokedAt: Date): Promise<boolean> {
    return this.repository.revoke(workspaceId, id, revokedAt);
  }

  /** Consumes an invitation if it remains active in its stored workspace. */
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

  /** Records best-effort delivery outcome after invitation commit. */
  markDelivery(
    workspaceId: string,
    id: string,
    status: 'SENT' | 'FAILED',
    attemptedAt: Date,
  ): Promise<void> {
    return this.repository.markDelivery(workspaceId, id, status, attemptedAt);
  }
}
