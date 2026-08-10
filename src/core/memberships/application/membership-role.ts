export const MEMBERSHIP_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const;

export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];
export type InvitableMembershipRole = Exclude<MembershipRole, 'OWNER'>;

export function isMembershipRole(value: unknown): value is MembershipRole {
  return MEMBERSHIP_ROLES.some((role) => role === value);
}

export function isInvitableMembershipRole(
  value: unknown,
): value is InvitableMembershipRole {
  return value === 'ADMIN' || value === 'MEMBER';
}
