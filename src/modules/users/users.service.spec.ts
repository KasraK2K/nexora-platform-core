import { AuditService, type AppendAuditLog } from '../audit/audit.service';
import type { SessionStateService } from '../authentication/session-state/session-state.service';
import { Clock } from '../../common/clock';
import { IdentifierFactory } from '../../common/identifier-factory';
import type { TransactionManager } from '../../common/transaction-manager';
import {
  UserLifecycleInvalidError,
  UserLifecycleUnavailableError,
} from './users.errors';
import type { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

const USER_ID = '01911457-9b3a-7cc3-9c3a-3b7508f69f5c';
const WORKSPACE_ID = '01911457-e820-7b71-b695-a07fb242b8ec';

describe('UsersService.updateOwnProfile', () => {
  it('updates only the active actor and audits without profile values', async () => {
    const audits: AppendAuditLog[] = [];
    const updateDisplayName = jest.fn(() => Promise.resolve(true));
    const service = new UsersService(
      users(updateDisplayName),
      sessionAuthority(true),
      new AuditService({
        append: (audit: AppendAuditLog) => {
          audits.push(audit);
          return Promise.resolve();
        },
      } as never),
      new IdentifierFactory(),
      fixedClock(),
      inlineTransactions(),
    );

    await expect(
      service.updateOwnProfile({
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
    const service = new UsersService(
      users(updateDisplayName),
      sessionAuthority(false),
      new AuditService({ append: () => Promise.resolve() } as never),
      new IdentifierFactory(),
      fixedClock(),
      inlineTransactions(),
    );
    await expect(
      service.updateOwnProfile({
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
    const service = new UsersService(
      users(updateDisplayName),
      sessionAuthority(true),
      new AuditService({
        append: (audit: AppendAuditLog) => {
          audits.push(audit);
          return Promise.resolve();
        },
      } as never),
      new IdentifierFactory(),
      fixedClock(),
      inlineTransactions(),
    );

    await expect(
      service.updateOwnProfile({
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
    const retrying = new UsersService(
      users(retryingUpdate),
      sessionAuthority(true),
      new AuditService({ append: () => Promise.resolve() } as never),
      new IdentifierFactory(),
      fixedClock(),
      inlineTransactions(),
    );
    await expect(
      retrying.updateOwnProfile({
        sessionId: '01911457-a173-70fc-a38f-22f4f688956b',
        actorUserId: USER_ID,
        workspaceId: WORKSPACE_ID,
        displayName: 'Updated Person',
      }),
    ).resolves.toMatchObject({ displayName: 'Updated Person' });
    expect(retryingUpdate).toHaveBeenCalledTimes(2);

    const conflictingUpdate = jest.fn(() => Promise.resolve(false));
    const conflicting = new UsersService(
      users(conflictingUpdate),
      sessionAuthority(true),
      new AuditService({ append: () => Promise.resolve() } as never),
      new IdentifierFactory(),
      fixedClock(),
      inlineTransactions(),
    );
    await expect(
      conflicting.updateOwnProfile({
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
    updateDisplayName: (
      input: Parameters<UsersRepository['updateDisplayName']>[0],
    ) => updateDisplayName(input),
  } as never;
}

function sessionAuthority(active: boolean): SessionStateService {
  return {
    hasActiveContext: () => Promise.resolve(active),
  } as never;
}

function fixedClock(): Clock {
  return { now: () => new Date('2026-08-11T00:00:00.000Z') };
}

function inlineTransactions(): TransactionManager {
  return { execute: (operation) => operation() };
}
