import { Injectable } from '@nestjs/common';
import type {
  InvitableMembershipRole,
  MembershipRole,
} from '../../memberships/application/membership-role';

export const PERMISSIONS = [
  'membership-invitation:create',
  'membership-invitation:revoke',
  'membership:read',
  'membership:role:update',
  'membership:remove',
  'membership:ownership:transfer',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

@Injectable()
export class AuthorizationPolicy {
  permits(role: MembershipRole, permission: Permission): boolean {
    switch (permission) {
      case 'membership-invitation:create':
      case 'membership-invitation:revoke':
      case 'membership:read':
      case 'membership:remove':
        return role === 'OWNER' || role === 'ADMIN';
      case 'membership:role:update':
      case 'membership:ownership:transfer':
        return role === 'OWNER';
      default:
        return false;
    }
  }

  mayInvite(
    actorRole: MembershipRole,
    targetRole: InvitableMembershipRole,
  ): boolean {
    if (actorRole === 'OWNER') {
      return targetRole === 'ADMIN' || targetRole === 'MEMBER';
    }
    return actorRole === 'ADMIN' && targetRole === 'MEMBER';
  }

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
}

export function isPermission(value: unknown): value is Permission {
  return PERMISSIONS.some((permission) => permission === value);
}
