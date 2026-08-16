/** Roles supported by the product-neutral workspace membership model. */
export const MEMBERSHIP_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const;

/** A role held by an active workspace membership. */
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

/** A role that an invitation may grant; invitations never create owners. */
export type InvitableMembershipRole = Exclude<MembershipRole, 'OWNER'>;

/** Narrows untrusted input to a non-owner role that an invitation may grant. */
export function isInvitableMembershipRole(
  value: unknown,
): value is InvitableMembershipRole {
  return value === 'ADMIN' || value === 'MEMBER';
}
