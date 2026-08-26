import { Injectable } from '@nestjs/common';
import type {
  InvitableMembershipRole,
  MembershipRole,
} from '../../memberships/memberships.service';

export { AuthorizationDeniedError } from '../errors/authorization-denied.error';

/** Closed catalog of product-neutral permissions understood by Core policy. */
export const PERMISSIONS = [
  'membership-invitation:create',
  'membership-invitation:revoke',
  'membership:read',
  'membership:role:update',
  'membership:remove',
  'membership:ownership:transfer',
  'workspace:update',
  'membership:self:leave',
] as const;
/** One permission from Core's closed permission catalog. */
export type Permission = (typeof PERMISSIONS)[number];

/** Pure base-RBAC policy; all unknown permission branches deny access. */
@Injectable()
export class AuthorizationPolicyService {
  /** Evaluates coarse role permission and denies any unrecognized branch. */
  permits(role: MembershipRole, permission: Permission): boolean {
    switch (permission) {
      case 'membership-invitation:create':
      case 'membership-invitation:revoke':
      case 'membership:read':
      case 'membership:remove':
      case 'workspace:update':
        return role === 'OWNER' || role === 'ADMIN';
      case 'membership:self:leave':
        return role === 'OWNER' || role === 'ADMIN' || role === 'MEMBER';
      case 'membership:role:update':
      case 'membership:ownership:transfer':
        return role === 'OWNER';
      default:
        return false;
    }
  }

  /** Allows owners to invite admins/members and admins to invite members. */
  mayInvite(
    actorRole: MembershipRole,
    targetRole: InvitableMembershipRole,
  ): boolean {
    if (actorRole === 'OWNER') {
      return targetRole === 'ADMIN' || targetRole === 'MEMBER';
    }
    return actorRole === 'ADMIN' && targetRole === 'MEMBER';
  }

  /** Allows only an owner to change a different non-owner's assignable role. */
  mayChangeMembershipRole(
    actor: { userId: string; role: MembershipRole },
    target: { userId: string; role: MembershipRole },
    targetRole: InvitableMembershipRole,
  ): boolean {
    return (
      actor.role === 'OWNER' &&
      actor.userId !== target.userId &&
      target.role !== 'OWNER' &&
      (targetRole === 'ADMIN' || targetRole === 'MEMBER')
    );
  }

  /** Prevents self-removal and permits only management of lower roles. */
  mayRemoveMembership(
    actor: { userId: string; role: MembershipRole },
    target: { userId: string; role: MembershipRole },
  ): boolean {
    if (actor.userId === target.userId) return false;
    if (actor.role === 'OWNER') {
      return target.role === 'ADMIN' || target.role === 'MEMBER';
    }
    return actor.role === 'ADMIN' && target.role === 'MEMBER';
  }

  /**
   * Allows an owner to replace themselves with a different active non-owner.
   * This is operational workspace ownership only; it does not change the
   * commercial `Organization.ownerUserId`.
   */
  mayTransferWorkspaceOwnership(
    actor: { userId: string; role: MembershipRole },
    target: { userId: string; role: MembershipRole },
  ): boolean {
    return (
      actor.role === 'OWNER' &&
      actor.userId !== target.userId &&
      (target.role === 'ADMIN' || target.role === 'MEMBER')
    );
  }

  /** Allows only non-owner members to use the protected self-leave flow. */
  mayLeaveWorkspace(role: MembershipRole): boolean {
    return role === 'ADMIN' || role === 'MEMBER';
  }
}

/** Narrows untrusted decorator metadata to Core's closed permission catalog. */
export function isPermission(value: unknown): value is Permission {
  return PERMISSIONS.some((permission) => permission === value);
}
