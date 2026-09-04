import {
  collectTypeScriptFiles,
  countCalls,
  readDependencies,
  readStringLiteralCallArguments,
  sourceRoot,
} from './architecture-helpers';

describe('workflow diagnostics', () => {
  it('keeps the complete set of actual safe workflow log events stable', () => {
    const files = collectTypeScriptFiles(sourceRoot).filter(
      (file) => !file.endsWith('.spec.ts'),
    );
    const directEvents = files.flatMap((file) =>
      readStringLiteralCallArguments(file, 'logSafeFailure', 1),
    );
    const delegatedMembershipEvents = readStringLiteralCallArguments(
      'src/modules/memberships/memberships.service.ts',
      'retryWrite',
      0,
      true,
    );
    const callFiles = files.filter(
      (file) => countCalls(file, 'logSafeFailure') > 0,
    );
    const directCallCount = callFiles.reduce(
      (count, file) => count + countCalls(file, 'logSafeFailure'),
      0,
    );

    expect([...directEvents, ...delegatedMembershipEvents].sort()).toEqual(
      [
        'authentication.credential_check_failed',
        'authentication.session_create_failed',
        'authentication.workspace_list_failed',
        'authentication.workspace_switch_failed',
        'email_verification.confirmation_failed',
        'email_verification.request_failed',
        'membership.invitation_accept_failed',
        'membership.invitation_create_failed',
        'membership.invitation_revoke_failed',
        'membership.list_failed',
        'membership.remove_failed',
        'membership.self_leave_failed',
        'password_change.context_resolution_failed',
        'password_change.credential_check_failed',
        'password_change.hash_failed',
        'password_change.transaction_failed',
        'password_reset.confirmation_failed',
        'password_reset.request_failed',
        'registration.transaction_failed',
        'user.profile_update_failed',
        'workspace.create_failed',
        'workspace.rename_failed',
      ].sort(),
    );
    expect(
      countCalls(
        'src/modules/memberships/memberships.service.ts',
        'logSafeFailure',
      ),
    ).toBe(2);
    expect(directCallCount - directEvents.length).toBe(1);
    expect(
      callFiles.flatMap((file) =>
        readDependencies(file).some(
          ({ target }) => target === 'src/common/logging/log-safe-failure',
        )
          ? []
          : [`${file}: does not import the shared logSafeFailure function`],
      ),
    ).toEqual([]);
  });
});
