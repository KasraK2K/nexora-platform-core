import { AuthorizationPolicyService } from './authorization-policy.service';

describe('AuthorizationPolicyService', () => {
  const policy = new AuthorizationPolicyService();

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
    ['OWNER', true, true, true],
    ['ADMIN', false, true, false],
    ['MEMBER', false, false, false],
  ] as const)(
    '%s membership administration permissions fail closed',
    (role, mayUpdateRole, mayRemove, mayTransferOwnership) => {
      expect(policy.permits(role, 'membership:role:update')).toBe(
        mayUpdateRole,
      );
      expect(policy.permits(role, 'membership:remove')).toBe(mayRemove);
      expect(policy.permits(role, 'membership:ownership:transfer')).toBe(
        mayTransferOwnership,
      );
    },
  );

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

  it('applies the role-change, removal, self-action, and ownership matrices', () => {
    const owner = { userId: 'owner', role: 'OWNER' } as const;
    const admin = { userId: 'admin', role: 'ADMIN' } as const;
    const member = { userId: 'member', role: 'MEMBER' } as const;

    expect(policy.mayChangeMembershipRole(owner, admin, 'MEMBER')).toBe(true);
    expect(policy.mayChangeMembershipRole(owner, member, 'ADMIN')).toBe(true);
    expect(policy.mayChangeMembershipRole(owner, owner, 'ADMIN')).toBe(false);
    expect(policy.mayChangeMembershipRole(admin, member, 'ADMIN')).toBe(false);

    expect(policy.mayRemoveMembership(owner, admin)).toBe(true);
    expect(policy.mayRemoveMembership(owner, member)).toBe(true);
    expect(policy.mayRemoveMembership(admin, member)).toBe(true);
    expect(policy.mayRemoveMembership(admin, admin)).toBe(false);
    expect(policy.mayRemoveMembership(owner, owner)).toBe(false);

    expect(policy.mayTransferWorkspaceOwnership(owner, admin)).toBe(true);
    expect(policy.mayTransferWorkspaceOwnership(owner, member)).toBe(true);
    expect(policy.mayTransferWorkspaceOwnership(owner, owner)).toBe(false);
    expect(policy.mayTransferWorkspaceOwnership(admin, member)).toBe(false);
    expect(policy.permits('OWNER', 'workspace:update')).toBe(true);
    expect(policy.permits('ADMIN', 'workspace:update')).toBe(true);
    expect(policy.permits('MEMBER', 'workspace:update')).toBe(false);
    expect(policy.permits('OWNER', 'membership:self:leave')).toBe(true);
    expect(policy.permits('ADMIN', 'membership:self:leave')).toBe(true);
    expect(policy.permits('MEMBER', 'membership:self:leave')).toBe(true);
    expect(policy.mayLeaveWorkspace('OWNER')).toBe(false);
    expect(policy.mayLeaveWorkspace('ADMIN')).toBe(true);
    expect(policy.mayLeaveWorkspace('MEMBER')).toBe(true);
    expect(policy.mayLeaveWorkspace('FUTURE' as never)).toBe(false);
    expect(
      policy.mayTransferWorkspaceOwnership(
        { userId: 'owner', role: 'FUTURE' as never },
        member,
      ),
    ).toBe(false);
  });
});
