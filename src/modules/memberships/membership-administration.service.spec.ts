import { AuditService, type AppendAuditLog } from '../audit/audit.service';
import type { SessionStateService } from '../authentication/session-state/session-state.service';
import {
  AuthorizationDeniedError,
  AuthorizationPolicyService,
} from '../authorization/policy/authorization-policy.service';
import { Clock } from '../../common/clock';
import { IdentifierFactory } from '../../common/identifier-factory';
import type { TransactionManager } from '../../common/transaction-manager';
import {
  MembershipLastWorkspaceProtectedError,
  MembershipOwnershipProtectedError,
} from './errors/membership-administration.errors';
import type { MembershipAdministrationRecord } from './repositories/memberships.repository';
import { MembershipAdministrationService } from './membership-administration.service';

const WORKSPACE_ID = '01911457-e820-7b71-b695-a07fb242b8ec';
const OWNER_USER_ID = '01911457-9b3a-7cc3-9c3a-3b7508f69f5c';
const OWNER_MEMBERSHIP_ID = '01911457-a173-70fc-a38f-22f4f688956b';
const TARGET_USER_ID = '01911457-b0bc-76bd-b8db-b9c43bbf4302';
const TARGET_MEMBERSHIP_ID = '01911457-c5b3-7eb8-9e52-c7b80b372506';

describe('MembershipAdministrationService', () => {
  it('lets only an OWNER change a different non-owner role and audits the change', async () => {
    const ownerFixture = createFixture('OWNER', 'ADMIN');
    const ownerService = createService(ownerFixture);

    await ownerService.changeRole({
      actorUserId: OWNER_USER_ID,
      workspaceId: WORKSPACE_ID,
      membershipId: TARGET_MEMBERSHIP_ID,
      role: 'MEMBER',
    });

    expect(ownerFixture.updateRole).toHaveBeenCalledWith(
      expect.objectContaining({
        membershipId: TARGET_MEMBERSHIP_ID,
        expectedRole: 'ADMIN',
        role: 'MEMBER',
      }),
    );
    expect(ownerFixture.audits).toEqual([
      expect.objectContaining({
        action: 'membership.role.updated',
        resourceId: TARGET_MEMBERSHIP_ID,
      }),
    ]);

    const adminFixture = createFixture('ADMIN', 'MEMBER');
    const adminService = createService(adminFixture);
    await expect(
      adminService.changeRole({
        actorUserId: OWNER_USER_ID,
        workspaceId: WORKSPACE_ID,
        membershipId: TARGET_MEMBERSHIP_ID,
        role: 'ADMIN',
      }),
    ).rejects.toBeInstanceOf(AuthorizationDeniedError);
  });

  it('soft-removes a MEMBER, revokes only workspace sessions, and protects OWNER', async () => {
    const fixture = createFixture('ADMIN', 'MEMBER');
    const service = createService(fixture);

    await service.remove({
      actorUserId: OWNER_USER_ID,
      workspaceId: WORKSPACE_ID,
      membershipId: TARGET_MEMBERSHIP_ID,
    });

    expect(fixture.revokeSessions).toHaveBeenCalledWith({
      userId: TARGET_USER_ID,
      workspaceId: WORKSPACE_ID,
      revokedAt: new Date('2026-08-11T00:00:00.000Z'),
    });
    expect(fixture.remove).toHaveBeenCalled();
    expect(fixture.clearCaches).toHaveBeenCalledWith([
      { tokenHash: 'session-hash' },
    ]);

    const protectedFixture = createFixture('OWNER', 'OWNER');
    const protectedService = createService(protectedFixture);
    await expect(
      protectedService.remove({
        actorUserId: OWNER_USER_ID,
        workspaceId: WORKSPACE_ID,
        membershipId: TARGET_MEMBERSHIP_ID,
      }),
    ).rejects.toBeInstanceOf(MembershipOwnershipProtectedError);
  });

  it('requires an active session and current password for an atomic one-owner transfer', async () => {
    const fixture = createFixture('OWNER', 'MEMBER');
    const service = createService(
      fixture,
      {
        findAuthenticationReferenceById: () =>
          Promise.resolve({
            id: OWNER_USER_ID,
            identityId: '01911457-d45f-70a4-b39f-da90c15616ee',
            status: 'ACTIVE',
          }),
      },
      { verify: () => Promise.resolve({}) },
    );

    await service.transferOwnership({
      sessionId: '01911457-e45f-70a4-b39f-da90c15616ee',
      actorUserId: OWNER_USER_ID,
      workspaceId: WORKSPACE_ID,
      membershipId: TARGET_MEMBERSHIP_ID,
      currentPassword: 'A secure passphrase 123',
    });

    expect(fixture.transferOwnership).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      currentOwnerMembershipId: OWNER_MEMBERSHIP_ID,
      targetMembershipId: TARGET_MEMBERSHIP_ID,
      expectedTargetRole: 'MEMBER',
    });
    expect(fixture.audits).toEqual([
      expect.objectContaining({
        action: 'membership.ownership.transferred',
        resourceId: TARGET_MEMBERSHIP_ID,
      }),
    ]);
  });

  it('lets a non-owner leave only when another active workspace remains', async () => {
    const fixture = createFixture('ADMIN', 'MEMBER');
    const service = createService(fixture);

    await service.leaveCurrent({
      sessionId: '01911457-e45f-70a4-b39f-da90c15616ee',
      actorUserId: OWNER_USER_ID,
      workspaceId: WORKSPACE_ID,
    });

    expect(fixture.remove).toHaveBeenCalledWith(
      expect.objectContaining({ membershipId: OWNER_MEMBERSHIP_ID }),
    );
    expect(fixture.revokeSessions).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: OWNER_USER_ID,
        workspaceId: WORKSPACE_ID,
      }),
    );
    expect(fixture.audits).toEqual([
      expect.objectContaining({
        action: 'membership.left',
        resourceId: OWNER_MEMBERSHIP_ID,
      }),
    ]);
    expect(fixture.clearCaches).toHaveBeenCalledWith([
      { tokenHash: 'session-hash' },
    ]);

    const lastFixture = createFixture('MEMBER', 'MEMBER', false);
    const lastService = createService(lastFixture);
    await expect(
      lastService.leaveCurrent({
        sessionId: '01911457-e45f-70a4-b39f-da90c15616ee',
        actorUserId: OWNER_USER_ID,
        workspaceId: WORKSPACE_ID,
      }),
    ).rejects.toBeInstanceOf(MembershipLastWorkspaceProtectedError);

    const ownerFixture = createFixture('OWNER', 'MEMBER');
    const ownerService = createService(ownerFixture);
    await expect(
      ownerService.leaveCurrent({
        sessionId: '01911457-e45f-70a4-b39f-da90c15616ee',
        actorUserId: OWNER_USER_ID,
        workspaceId: WORKSPACE_ID,
      }),
    ).rejects.toBeInstanceOf(MembershipOwnershipProtectedError);

    const staleFixture = createFixture('MEMBER', 'MEMBER', true, false);
    const staleService = createService(staleFixture);
    await expect(
      staleService.leaveCurrent({
        sessionId: '01911457-e45f-70a4-b39f-da90c15616ee',
        actorUserId: OWNER_USER_ID,
        workspaceId: WORKSPACE_ID,
      }),
    ).rejects.toBeInstanceOf(AuthorizationDeniedError);
    expect(staleFixture.revokeSessions).not.toHaveBeenCalled();
    expect(staleFixture.remove).not.toHaveBeenCalled();
    expect(staleFixture.audits).toEqual([]);
  });
});

function createFixture(
  actorRole: MembershipAdministrationRecord['role'],
  targetRole: MembershipAdministrationRecord['role'],
  hasOtherActiveMembership = true,
  sessionIsActive = true,
) {
  const audits: AppendAuditLog[] = [];
  const actor = membership(OWNER_MEMBERSHIP_ID, OWNER_USER_ID, actorRole);
  const target = membership(TARGET_MEMBERSHIP_ID, TARGET_USER_ID, targetRole);
  const updateRole = jest.fn(() => Promise.resolve(true));
  const remove = jest.fn(() => Promise.resolve(true));
  const transferOwnership = jest.fn(() => Promise.resolve(true));
  const memberships = {
    findActiveForUser: () => Promise.resolve(actor),
    findActiveById: () => Promise.resolve(target),
    updateRole,
    remove,
    countActiveOwners: () => Promise.resolve(1),
    hasOtherActiveForUser: () => Promise.resolve(hasOtherActiveMembership),
    transferOwnership,
  };
  const revokeSessions = jest.fn(() =>
    Promise.resolve([{ tokenHash: 'session-hash' }]),
  );
  const clearCaches = jest.fn(() => Promise.resolve());
  const sessionRevocations = {
    hasActiveContext: () => Promise.resolve(sessionIsActive),
    revokeActiveForMembership: revokeSessions,
    clearCachesBestEffort: clearCaches,
  } satisfies Pick<
    SessionStateService,
    'hasActiveContext' | 'revokeActiveForMembership' | 'clearCachesBestEffort'
  >;

  return {
    memberships,
    updateRole,
    remove,
    transferOwnership,
    revokeSessions,
    clearCaches,
    sessionRevocations,
    audits,
    auditLog: new AuditService({
      append: (audit: AppendAuditLog) => {
        audits.push(audit);
        return Promise.resolve();
      },
    } as never),
  };
}

function createService(
  fixture: ReturnType<typeof createFixture>,
  users: object = {},
  passwordCredentials: object = {},
): MembershipAdministrationService {
  return new MembershipAdministrationService(
    fixture.memberships as never,
    fixture.sessionRevocations as never,
    users as never,
    passwordCredentials as never,
    new AuthorizationPolicyService(),
    fixture.auditLog,
    new IdentifierFactory(),
    fixedClock(),
    inlineTransactions(),
  );
}

function membership(
  id: string,
  userId: string,
  role: MembershipAdministrationRecord['role'],
): MembershipAdministrationRecord {
  return {
    id,
    userId,
    workspaceId: WORKSPACE_ID,
    role,
    createdAt: new Date('2026-08-10T00:00:00.000Z'),
  };
}

function fixedClock(): Clock {
  return { now: () => new Date('2026-08-11T00:00:00.000Z') };
}

function inlineTransactions(): TransactionManager {
  return { execute: (operation) => operation() };
}
