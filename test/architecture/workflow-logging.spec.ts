import { readSource } from './architecture-helpers';

describe('workflow diagnostics', () => {
  it('keeps stable safe workflow event names in cohesive services', () => {
    const expectedEvents = new Map<string, readonly string[]>([
      [
        'src/modules/authentication/services/session-login.service.ts',
        ['authentication.session_create_failed'],
      ],
      [
        'src/modules/authentication/services/workspace-session.service.ts',
        [
          'authentication.workspace_list_failed',
          'authentication.workspace_switch_failed',
        ],
      ],
      [
        'src/modules/authentication/services/password-reset.service.ts',
        ['password_reset.request_failed', 'password_reset.confirmation_failed'],
      ],
      [
        'src/modules/authentication/services/password-change.service.ts',
        ['password_change.transaction_failed'],
      ],
      [
        'src/modules/authentication/services/email-verification.service.ts',
        [
          'email_verification.request_failed',
          'email_verification.confirmation_failed',
        ],
      ],
      [
        'src/modules/memberships/memberships.service.ts',
        [
          'membership.list_failed',
          'membership.self_leave_failed',
          'membership.remove_failed',
        ],
      ],
      [
        'src/modules/memberships/membership-invitations.service.ts',
        [
          'membership.invitation_create_failed',
          'membership.invitation_accept_failed',
          'membership.invitation_revoke_failed',
        ],
      ],
    ]);

    for (const [file, expected] of expectedEvents) {
      const source = readSource(file);
      for (const event of expected) expect(source).toContain(event);
    }
  });
});
