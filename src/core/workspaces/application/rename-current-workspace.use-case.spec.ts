import {
  AuditLog,
  type AppendAuditLog,
} from '../../audit/application/audit-log';
import type { MembershipSessionRevocations } from '../../authentication/application/membership-session-revocations';
import { AuthorizationPolicy } from '../../authorization/application/authorization-policy';
import { AuthorizationDeniedError } from '../../authorization/application/authorization-denied.error';
import { Memberships } from '../../memberships/application/memberships';
import type { MembershipRole } from '../../memberships/application/membership-role';
import { IdentifierFactory } from '../../../shared/application/identifier-factory';
import { RenameCurrentWorkspace } from './rename-current-workspace.use-case';
import type { WorkspacesRepository } from './workspaces';
import {
  WorkspaceLifecycleInvalidError,
  WorkspaceLifecycleUnavailableError,
} from '../domain/workspace-lifecycle.errors';

const USER_ID = '01911457-9b3a-7cc3-9c3a-3b7508f69f5c';
const ORGANIZATION_ID = '01911457-a173-70fc-a38f-22f4f688956b';
const WORKSPACE_ID = '01911457-e820-7b71-b695-a07fb242b8ec';

describe('RenameCurrentWorkspace', () => {
  it.each(['OWNER', 'ADMIN'] as const)(
    '%s can rename and audit',
    async (role) => {
      const fixture = createFixture(role);
      await expect(
        fixture.useCase.execute({
          sessionId: '01911457-b0bc-76bd-b8db-b9c43bbf4302',
          actorUserId: USER_ID,
          organizationId: ORGANIZATION_ID,
          workspaceId: WORKSPACE_ID,
          name: '  Renamed Workspace  ',
        }),
      ).resolves.toMatchObject({ name: 'Renamed Workspace' });
      expect(fixture.rename).toHaveBeenCalledWith({
        id: WORKSPACE_ID,
        organizationId: ORGANIZATION_ID,
        expectedName: 'Original Workspace',
        name: 'Renamed Workspace',
      });
      expect(fixture.audits).toEqual([
        expect.objectContaining({
          action: 'workspace.renamed',
          resourceId: WORKSPACE_ID,
        }),
      ]);
    },
  );

  it('denies MEMBER and foreign organization context without writes', async () => {
    for (const input of [
      { role: 'MEMBER' as const, organizationId: ORGANIZATION_ID },
      { role: 'OWNER' as const, organizationId: 'foreign-organization' },
    ]) {
      const fixture = createFixture(input.role);
      await expect(
        fixture.useCase.execute({
          sessionId: '01911457-b0bc-76bd-b8db-b9c43bbf4302',
          actorUserId: USER_ID,
          organizationId: input.organizationId,
          workspaceId: WORKSPACE_ID,
          name: 'Renamed Workspace',
        }),
      ).rejects.toBeInstanceOf(AuthorizationDeniedError);
      expect(fixture.rename).not.toHaveBeenCalled();
    }
  });

  it('does not write or audit an unchanged workspace name', async () => {
    const fixture = createFixture('OWNER');
    await expect(
      fixture.useCase.execute({
        sessionId: '01911457-b0bc-76bd-b8db-b9c43bbf4302',
        actorUserId: USER_ID,
        organizationId: ORGANIZATION_ID,
        workspaceId: WORKSPACE_ID,
        name: '  Original Workspace  ',
      }),
    ).resolves.toMatchObject({ name: 'Original Workspace' });
    expect(fixture.rename).not.toHaveBeenCalled();
    expect(fixture.audits).toEqual([]);
  });

  it('retries conditional conflicts and rejects a stale session', async () => {
    const retrying = createFixture('OWNER', [false, true]);
    await expect(
      retrying.useCase.execute({
        sessionId: '01911457-b0bc-76bd-b8db-b9c43bbf4302',
        actorUserId: USER_ID,
        organizationId: ORGANIZATION_ID,
        workspaceId: WORKSPACE_ID,
        name: 'Renamed Workspace',
      }),
    ).resolves.toMatchObject({ name: 'Renamed Workspace' });
    expect(retrying.rename).toHaveBeenCalledTimes(2);

    const conflicting = createFixture('OWNER', [false, false]);
    await expect(
      conflicting.useCase.execute({
        sessionId: '01911457-b0bc-76bd-b8db-b9c43bbf4302',
        actorUserId: USER_ID,
        organizationId: ORGANIZATION_ID,
        workspaceId: WORKSPACE_ID,
        name: 'Renamed Workspace',
      }),
    ).rejects.toBeInstanceOf(WorkspaceLifecycleUnavailableError);

    const stale = createFixture('OWNER', [true], false);
    await expect(
      stale.useCase.execute({
        sessionId: '01911457-b0bc-76bd-b8db-b9c43bbf4302',
        actorUserId: USER_ID,
        organizationId: ORGANIZATION_ID,
        workspaceId: WORKSPACE_ID,
        name: 'Renamed Workspace',
      }),
    ).rejects.toBeInstanceOf(WorkspaceLifecycleInvalidError);
    expect(stale.rename).not.toHaveBeenCalled();
  });
});

function createFixture(
  role: MembershipRole,
  renameResults: boolean[] = [true],
  sessionIsActive = true,
) {
  const audits: AppendAuditLog[] = [];
  const rename = jest.fn<
    ReturnType<WorkspacesRepository['rename']>,
    Parameters<WorkspacesRepository['rename']>
  >((input) => {
    void input;
    return Promise.resolve(renameResults.shift() ?? true);
  });
  const workspaces: WorkspacesRepository = {
    create: () => Promise.resolve(),
    findById: () =>
      Promise.resolve({
        id: WORKSPACE_ID,
        organizationId: ORGANIZATION_ID,
        name: 'Original Workspace',
      }),
    findByIds: () => Promise.resolve([]),
    rename: (input) => rename(input),
  };
  const memberships = new Memberships({
    createOwner: () => Promise.resolve(),
    createInvited: () => Promise.resolve(),
    find: () =>
      Promise.resolve({ userId: USER_ID, workspaceId: WORKSPACE_ID, role }),
    listForUser: () => Promise.resolve([]),
  });
  const useCase = new RenameCurrentWorkspace(
    workspaces,
    memberships,
    {
      hasActiveContext: () => Promise.resolve(sessionIsActive),
    } satisfies Pick<MembershipSessionRevocations, 'hasActiveContext'>,
    new AuthorizationPolicy(),
    new AuditLog({
      append: (audit) => (audits.push(audit), Promise.resolve()),
    }),
    new IdentifierFactory(),
    { now: () => new Date('2026-08-11T00:00:00.000Z') },
    { execute: (operation) => operation() },
  );
  return { audits, rename, useCase };
}
