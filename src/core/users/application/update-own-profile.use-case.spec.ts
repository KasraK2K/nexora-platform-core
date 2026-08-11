import {
  AuditLog,
  type AppendAuditLog,
} from '../../audit/application/audit-log';
import type { MembershipSessionRevocations } from '../../authentication/application/membership-session-revocations';
import { Clock } from '../../../shared/application/clock';
import { IdentifierFactory } from '../../../shared/application/identifier-factory';
import type { TransactionManager } from '../../../shared/application/transaction-manager.port';
import {
  UserLifecycleInvalidError,
  UserLifecycleUnavailableError,
} from '../domain/user-lifecycle.errors';
import { UpdateOwnProfile } from './update-own-profile.use-case';
import type { UsersRepository } from './users';

const USER_ID = '01911457-9b3a-7cc3-9c3a-3b7508f69f5c';
const WORKSPACE_ID = '01911457-e820-7b71-b695-a07fb242b8ec';

describe('UpdateOwnProfile', () => {
  it('updates only the active actor and audits without profile values', async () => {
    const audits: AppendAuditLog[] = [];
    const updateDisplayName = jest.fn(() => Promise.resolve(true));
    const useCase = new UpdateOwnProfile(
      users(updateDisplayName),
      sessionAuthority(true),
      new AuditLog({
        append: (audit) => (audits.push(audit), Promise.resolve()),
      }),
      new IdentifierFactory(),
      fixedClock(),
      inlineTransactions(),
    );

    await expect(
      useCase.execute({
        sessionId: '01911457-a173-70fc-a38f-22f4f688956b',
        actorUserId: USER_ID,
        workspaceId: WORKSPACE_ID,
        displayName: '  Updated Person  ',
      }),
    ).resolves.toMatchObject({ displayName: 'Updated Person' });
    expect(updateDisplayName).toHaveBeenCalledWith({
      id: USER_ID,
      expectedDisplayName: 'Original Person',
      displayName: 'Updated Person',
    });
    expect(audits).toEqual([
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        actorUserId: USER_ID,
        action: 'user.profile.updated',
        resourceId: USER_ID,
      }),
    ]);
    expect(JSON.stringify(audits)).not.toContain('Updated Person');
  });

  it('rejects a stale session before writing', async () => {
    const updateDisplayName = jest.fn(() => Promise.resolve(true));
    const useCase = new UpdateOwnProfile(
      users(updateDisplayName),
      sessionAuthority(false),
      new AuditLog({ append: () => Promise.resolve() }),
      new IdentifierFactory(),
      fixedClock(),
      inlineTransactions(),
    );
    await expect(
      useCase.execute({
        sessionId: '01911457-a173-70fc-a38f-22f4f688956b',
        actorUserId: USER_ID,
        workspaceId: WORKSPACE_ID,
        displayName: 'Updated Person',
      }),
    ).rejects.toBeInstanceOf(UserLifecycleInvalidError);
    expect(updateDisplayName).not.toHaveBeenCalled();
  });

  it('does not write or audit an unchanged display name', async () => {
    const audits: AppendAuditLog[] = [];
    const updateDisplayName = jest.fn(() => Promise.resolve(true));
    const useCase = new UpdateOwnProfile(
      users(updateDisplayName),
      sessionAuthority(true),
      new AuditLog({
        append: (audit) => (audits.push(audit), Promise.resolve()),
      }),
      new IdentifierFactory(),
      fixedClock(),
      inlineTransactions(),
    );

    await expect(
      useCase.execute({
        sessionId: '01911457-a173-70fc-a38f-22f4f688956b',
        actorUserId: USER_ID,
        workspaceId: WORKSPACE_ID,
        displayName: '  Original Person  ',
      }),
    ).resolves.toMatchObject({ displayName: 'Original Person' });
    expect(updateDisplayName).not.toHaveBeenCalled();
    expect(audits).toEqual([]);
  });

  it('retries a stale conditional write and maps a repeated conflict safely', async () => {
    const retryingUpdate = jest
      .fn(() => Promise.resolve(true))
      .mockResolvedValueOnce(false);
    const retrying = new UpdateOwnProfile(
      users(retryingUpdate),
      sessionAuthority(true),
      new AuditLog({ append: () => Promise.resolve() }),
      new IdentifierFactory(),
      fixedClock(),
      inlineTransactions(),
    );
    await expect(
      retrying.execute({
        sessionId: '01911457-a173-70fc-a38f-22f4f688956b',
        actorUserId: USER_ID,
        workspaceId: WORKSPACE_ID,
        displayName: 'Updated Person',
      }),
    ).resolves.toMatchObject({ displayName: 'Updated Person' });
    expect(retryingUpdate).toHaveBeenCalledTimes(2);

    const conflictingUpdate = jest.fn(() => Promise.resolve(false));
    const conflicting = new UpdateOwnProfile(
      users(conflictingUpdate),
      sessionAuthority(true),
      new AuditLog({ append: () => Promise.resolve() }),
      new IdentifierFactory(),
      fixedClock(),
      inlineTransactions(),
    );
    await expect(
      conflicting.execute({
        sessionId: '01911457-a173-70fc-a38f-22f4f688956b',
        actorUserId: USER_ID,
        workspaceId: WORKSPACE_ID,
        displayName: 'Updated Person',
      }),
    ).rejects.toBeInstanceOf(UserLifecycleUnavailableError);
    expect(conflictingUpdate).toHaveBeenCalledTimes(2);
  });
});

function users(
  updateDisplayName: (
    input: Parameters<UsersRepository['updateDisplayName']>[0],
  ) => Promise<boolean>,
): UsersRepository {
  return {
    create: () => Promise.resolve(),
    findById: () =>
      Promise.resolve({
        id: USER_ID,
        displayName: 'Original Person',
        status: 'ACTIVE',
      }),
    findAuthenticationReferenceById: () => Promise.resolve(null),
    findByIdentityId: () => Promise.resolve(null),
    findActiveByIdentityId: () => Promise.resolve(null),
    activate: () => Promise.resolve(false),
    updateDisplayName: (input) => updateDisplayName(input),
  };
}

function sessionAuthority(
  active: boolean,
): Pick<MembershipSessionRevocations, 'hasActiveContext'> {
  return {
    hasActiveContext: () => Promise.resolve(active),
  };
}

function fixedClock(): Clock {
  return { now: () => new Date('2026-08-11T00:00:00.000Z') };
}

function inlineTransactions(): TransactionManager {
  return { execute: (operation) => operation() };
}
