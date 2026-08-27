import { isPermission, permits } from './authorization.policy';

describe('authorization policy', () => {
  it('derives owner-only administration without an ADMIN role', () => {
    expect(permits('OWNER', 'workspace:update')).toBe(true);
    expect(permits('OWNER', 'membership:remove')).toBe(true);
    expect(permits('MEMBER', 'workspace:update')).toBe(false);
    expect(permits('MEMBER', 'membership-invitation:create')).toBe(false);
    expect(permits('MEMBER', 'membership:self:leave')).toBe(true);
  });

  it('denies values outside the closed permission catalog', () => {
    expect(isPermission('membership:role:update')).toBe(false);
    expect(isPermission('membership:ownership:transfer')).toBe(false);
  });
});
