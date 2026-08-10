import { AuthorizationPolicy } from './authorization-policy';

describe('AuthorizationPolicy', () => {
  const policy = new AuthorizationPolicy();

  it.each([
    ['OWNER', true],
    ['ADMIN', true],
    ['MEMBER', false],
  ] as const)('%s permission to create invitations is %s', (role, allowed) => {
    expect(policy.permits(role, 'membership-invitation:create')).toBe(allowed);
    expect(policy.permits(role, 'membership-invitation:revoke')).toBe(allowed);
    expect(policy.permits(role, 'membership:read')).toBe(allowed);
  });

  it.each([
    ['OWNER', 'ADMIN', true],
    ['OWNER', 'MEMBER', true],
    ['ADMIN', 'ADMIN', false],
    ['ADMIN', 'MEMBER', true],
    ['MEMBER', 'ADMIN', false],
    ['MEMBER', 'MEMBER', false],
  ] as const)('%s inviting %s is %s', (actorRole, targetRole, allowed) => {
    expect(policy.mayInvite(actorRole, targetRole)).toBe(allowed);
  });

  it('fails closed for unknown future roles and permissions at runtime', () => {
    expect(
      policy.permits('SUPER_ADMIN' as never, 'membership-invitation:create'),
    ).toBe(false);
    expect(policy.permits('OWNER', 'unknown' as never)).toBe(false);
  });
});
