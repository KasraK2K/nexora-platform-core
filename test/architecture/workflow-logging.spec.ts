import { readSource } from './architecture-helpers';

describe('workflow diagnostics', () => {
  it('preserves stable logger contexts after service splitting', () => {
    const expectedContexts = new Map<string, readonly string[]>([
      [
        'src/modules/authentication/services/session-login.service.ts',
        ['CreateSession'],
      ],
      [
        'src/modules/authentication/services/workspace-session.service.ts',
        ['ListSessionWorkspaces', 'SwitchWorkspace'],
      ],
      [
        'src/modules/authentication/services/password-reset.service.ts',
        ['RequestPasswordReset', 'ResetPassword'],
      ],
      [
        'src/modules/authentication/services/password-change.service.ts',
        ['ChangePassword'],
      ],
      [
        'src/modules/authentication/services/email-verification.service.ts',
        ['RequestEmailVerification', 'VerifyEmail'],
      ],
      [
        'src/modules/memberships/membership-administration.service.ts',
        [
          'ListWorkspaceMemberships',
          'LeaveCurrentWorkspace',
          'ChangeMembershipRole',
          'RemoveMembership',
          'TransferWorkspaceOwnership',
        ],
      ],
      [
        'src/modules/memberships/membership-invitations.service.ts',
        [
          'CreateMembershipInvitation',
          'AcceptMembershipInvitation',
          'RevokeMembershipInvitation',
        ],
      ],
    ]);

    for (const [file, expected] of expectedContexts) {
      const actual = [
        ...readSource(file).matchAll(/new Logger\(\s*'([^']+)'/g),
      ].map((match) => match[1]);
      expect(actual).toEqual(expected);
    }
  });
});
