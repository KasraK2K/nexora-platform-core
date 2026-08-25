import type { InvitableMembershipRole } from '../domain/membership-role';

/** Injection token for invitation persistence. */
export const MEMBERSHIP_INVITATIONS_REPOSITORY = Symbol(
  'MEMBERSHIP_INVITATIONS_REPOSITORY',
);

/** Safe invitation fields returned to application services; no raw token. */
export type MembershipInvitationRecord = Readonly<{
  id: string;
  workspaceId: string;
  invitedByUserId: string;
  normalizedEmail: string;
  role: InvitableMembershipRole;
}>;

/** Persistence contract for hashed, email-bound membership invitations. */
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
  /** Retires a replaceable active invitation for one workspace and email. */
  retireActive(
    workspaceId: string,
    normalizedEmail: string,
    revokedAt: Date,
  ): Promise<void>;
  /** Finds an unexpired invitation by token hash for email-bound acceptance. */
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
  /** Records only coarse post-commit delivery status. */
  markDelivery(
    workspaceId: string,
    id: string,
    status: 'SENT' | 'FAILED',
    attemptedAt: Date,
  ): Promise<void>;
}
