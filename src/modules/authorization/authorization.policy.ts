/** Public role derived from permanent workspace ownership. */
export type WorkspaceRole = 'OWNER' | 'MEMBER';

/** Closed permission catalog used by deny-by-default route admission. */
export const PERMISSIONS = [
  'membership-invitation:create',
  'membership-invitation:revoke',
  'membership:read',
  'membership:remove',
  'workspace:update',
  'membership:self:leave',
] as const;

/** Permission names that controllers may request from route admission. */
export type Permission = (typeof PERMISSIONS)[number];

/** Pure coarse policy; service methods still revalidate current records. */
export function permits(role: WorkspaceRole, permission: Permission): boolean {
  if (permission === 'membership:self:leave') return true;
  return role === 'OWNER';
}

/** Narrows untrusted route metadata to the closed permission catalog. */
export function isPermission(value: unknown): value is Permission {
  return PERMISSIONS.some((permission) => permission === value);
}
