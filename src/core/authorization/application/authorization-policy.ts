import { Injectable } from '@nestjs/common';
import type {
  InvitableMembershipRole,
  MembershipRole,
} from '../../memberships/application/membership-role';

export const PERMISSIONS = [
  'membership-invitation:create',
  'membership-invitation:revoke',
  'membership:read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

@Injectable()
export class AuthorizationPolicy {
  permits(role: MembershipRole, permission: Permission): boolean {
    switch (permission) {
      case 'membership-invitation:create':
      case 'membership-invitation:revoke':
      case 'membership:read':
        return role === 'OWNER' || role === 'ADMIN';
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
}

export function isPermission(value: unknown): value is Permission {
  return PERMISSIONS.some((permission) => permission === value);
}
