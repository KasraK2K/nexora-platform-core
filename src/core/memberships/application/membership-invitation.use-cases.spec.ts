import {
  AuditLog,
  type AppendAuditLog,
} from '../../audit/application/audit-log';
import { AuthorizationPolicy } from '../../authorization/application/authorization-policy';
import { AuthorizationDeniedError } from '../../authorization/application/authorization-denied.error';
import { Clock } from '../../../shared/application/clock';
import { IdentifierFactory } from '../../../shared/application/identifier-factory';
import type { TransactionManager } from '../../../shared/application/transaction-manager.port';
import {
  MembershipInvitationConflictError,
  MembershipInvitationInvalidError,
} from '../domain/membership-invitation.errors';
import type { MembershipRole } from './membership-role';
import { AcceptMembershipInvitation } from './accept-membership-invitation.use-case';
import { CreateMembershipInvitation } from './create-membership-invitation.use-case';
import { MembershipInvitationTokenService } from './membership-invitation-token.service';
import { MembershipInvitations } from './membership-invitations';
import { Memberships, type MembershipsRepository } from './memberships';
import { InvitedMembershipsWriter } from './invited-memberships-writer';

const WORKSPACE_ID = '01911457-e820-7b71-b695-a07fb242b8ec';
const ACTOR_ID = '01911457-9b3a-7cc3-9c3a-3b7508f69f5c';
const INVITEE_ID = '01911457-a173-70fc-a38f-22f4f688956b';
const INVITER_ID = '01911457-b0bc-76bd-b8db-b9c43bbf4302';
const IDENTITY_ID = '01911457-c5b3-7eb8-9e52-c7b80b372506';

describe('membership invitation use cases', () => {
  it.each([
    ['OWNER', 'ADMIN'],
    ['OWNER', 'MEMBER'],
    ['ADMIN', 'MEMBER'],
  ] as const)('%s can issue a %s invitation', async (actorRole, targetRole) => {
    const fixture = createIssueFixture(actorRole);

    const result = await fixture.useCase.execute({
      actorUserId: ACTOR_ID,
      workspaceId: WORKSPACE_ID,
      email: 'Person@Example.com',
      role: targetRole,
    });

    expect(result).toMatchObject({
      workspaceId: WORKSPACE_ID,
      normalizedEmail: 'person@example.com',
      role: targetRole,
      emailSent: true,
    });
    expect(fixture.invitations.created).toHaveLength(1);
    expect(fixture.invitations.created[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(fixture.delivery).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        email: 'person@example.com',
        role: targetRole,
      }),
    );
    expect(fixture.audits).toHaveLength(1);
  });

  it.each([
    ['ADMIN', 'ADMIN'],
    ['MEMBER', 'ADMIN'],
    ['MEMBER', 'MEMBER'],
  ] as const)(
    '%s cannot issue a %s invitation',
    async (actorRole, targetRole) => {
      const fixture = createIssueFixture(actorRole);

      await expect(
        fixture.useCase.execute({
          actorUserId: ACTOR_ID,
          workspaceId: WORKSPACE_ID,
          email: 'person@example.com',
          role: targetRole,
        }),
      ).rejects.toBeInstanceOf(AuthorizationDeniedError);
      expect(fixture.invitations.created).toHaveLength(0);
      expect(fixture.delivery).not.toHaveBeenCalled();
      expect(fixture.audits).toHaveLength(0);
    },
  );

  it('rejects an invitation when the target already belongs to the workspace', async () => {
    const fixture = createIssueFixture('OWNER', true);

    await expect(
      fixture.useCase.execute({
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        email: 'person@example.com',
        role: 'MEMBER',
      }),
    ).rejects.toBeInstanceOf(MembershipInvitationConflictError);
    expect(fixture.invitations.created).toHaveLength(0);
  });

  it('accepts once only for the active account owning the invited email', async () => {
    const fixture = createAcceptanceFixture();

    await fixture.useCase.execute({
      actorUserId: INVITEE_ID,
      token: fixture.rawToken,
    });

    expect(fixture.accepted).toBe(true);
    expect(fixture.createdMemberships).toEqual([
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        userId: INVITEE_ID,
        role: 'ADMIN',
      }),
    ]);
    expect(fixture.audits).toEqual([
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        actorUserId: INVITEE_ID,
        action: 'membership.invitation.accepted',
      }),
    ]);

    await expect(
      fixture.useCase.execute({
        actorUserId: INVITEE_ID,
        token: fixture.rawToken,
      }),
    ).rejects.toBeInstanceOf(MembershipInvitationInvalidError);
  });

  it('rejects email mismatch and revoked inviter authority without side effects', async () => {
    for (const overrides of [
      { normalizedEmail: 'attacker@example.com' },
      { inviterRole: 'MEMBER' as const },
    ]) {
      const fixture = createAcceptanceFixture(overrides);
      await expect(
        fixture.useCase.execute({
          actorUserId: INVITEE_ID,
          token: fixture.rawToken,
        }),
      ).rejects.toBeInstanceOf(MembershipInvitationInvalidError);
      expect(fixture.createdMemberships).toHaveLength(0);
      expect(fixture.audits).toHaveLength(0);
    }
  });
});

function createIssueFixture(
  actorRole: MembershipRole,
  targetAlreadyMember = false,
) {
  const audits: AppendAuditLog[] = [];
  const invitations = new RecordingInvitations();
  const delivery = jest.fn(() => Promise.resolve());
  const memberships = new Memberships({
    createOwner: () => Promise.resolve(),
    createInvited: () => Promise.resolve(),
    find: ({ userId }: { workspaceId: string; userId: string }) =>
      Promise.resolve(
        userId === ACTOR_ID
          ? { userId, workspaceId: WORKSPACE_ID, role: actorRole }
          : targetAlreadyMember
            ? { userId, workspaceId: WORKSPACE_ID, role: 'MEMBER' }
            : null,
      ),
    listForUser: () => Promise.resolve([]),
  });
  const identities = {
    findByEmail: () =>
      Promise.resolve({
        id: IDENTITY_ID,
        normalizedEmail: 'person@example.com',
      }),
  };
  const users = {
    findByIdentityId: () =>
      Promise.resolve({
        id: INVITEE_ID,
        displayName: 'Invitee',
        status: 'ACTIVE' as const,
      }),
  };

  return {
    audits,
    invitations,
    delivery,
    useCase: new CreateMembershipInvitation(
      memberships,
      new MembershipInvitations(invitations),
      identities,
      users,
      new AuthorizationPolicy(),
      new AuditLog({
        append: (audit) => {
          audits.push(audit);
          return Promise.resolve();
        },
      }),
      {
        enqueue: delivery,
        attempt: () => Promise.resolve(true),
      },
      new MembershipInvitationTokenService(),
      new IdentifierFactory(),
      fixedClock(),
      { membershipInvitationTtlSeconds: 3600 },
      inlineTransactions(),
    ),
  };
}

function createAcceptanceFixture(
  overrides: {
    normalizedEmail?: string;
    inviterRole?: MembershipRole;
  } = {},
) {
  const tokenService = new MembershipInvitationTokenService();
  const token = tokenService.create();
  let accepted = false;
  const createdMemberships: Array<{
    id: string;
    workspaceId: string;
    userId: string;
    role: MembershipRole;
  }> = [];
  const audits: AppendAuditLog[] = [];
  const invitations = new MembershipInvitations({
    create: () => Promise.resolve(),
    retireActive: () => Promise.resolve(),
    findUsableByTokenHash: () =>
      Promise.resolve(
        accepted
          ? null
          : {
              id: '01911457-d45f-70a4-b39f-da90c15616ee',
              workspaceId: WORKSPACE_ID,
              invitedByUserId: INVITER_ID,
              normalizedEmail: 'person@example.com',
              role: 'ADMIN',
            },
      ),
    findActiveById: () => Promise.resolve(null),
    findActiveForEmail: () => Promise.resolve(null),
    revoke: () => Promise.resolve(false),
    accept: () => {
      if (accepted) return Promise.resolve(false);
      accepted = true;
      return Promise.resolve(true);
    },
    markDelivery: () => Promise.resolve(),
  });
  const membershipsRepository = {
    createOwner: () => Promise.resolve(),
    createInvited: (input: {
      id: string;
      workspaceId: string;
      userId: string;
      role: Exclude<MembershipRole, 'OWNER'>;
    }) => {
      createdMemberships.push(input);
      return Promise.resolve();
    },
    find: ({ userId }: { workspaceId: string; userId: string }) =>
      Promise.resolve(
        userId === INVITER_ID
          ? {
              userId,
              workspaceId: WORKSPACE_ID,
              role: overrides.inviterRole ?? 'OWNER',
            }
          : null,
      ),
    listForUser: () => Promise.resolve([]),
  } satisfies MembershipsRepository;
  const memberships = new Memberships(membershipsRepository);
  const users = {
    findAuthenticationReferenceById: () =>
      Promise.resolve({
        id: INVITEE_ID,
        identityId: IDENTITY_ID,
        status: 'ACTIVE' as const,
      }),
  };
  const identities = {
    findById: () =>
      Promise.resolve({
        id: IDENTITY_ID,
        normalizedEmail: overrides.normalizedEmail ?? 'person@example.com',
      }),
  };

  return {
    rawToken: token.raw,
    get accepted() {
      return accepted;
    },
    createdMemberships,
    audits,
    useCase: new AcceptMembershipInvitation(
      memberships,
      new InvitedMembershipsWriter(membershipsRepository),
      invitations,
      users,
      identities,
      new AuthorizationPolicy(),
      new AuditLog({
        append: (audit) => {
          audits.push(audit);
          return Promise.resolve();
        },
      }),
      tokenService,
      new IdentifierFactory(),
      fixedClock(),
      inlineTransactions(),
    ),
  };
}

class RecordingInvitations {
  readonly created: Array<{
    tokenHash: string;
  }> = [];

  create(input: { tokenHash: string }): Promise<void> {
    this.created.push(input);
    return Promise.resolve();
  }

  retireActive(): Promise<void> {
    return Promise.resolve();
  }

  findUsableByTokenHash(): Promise<null> {
    return Promise.resolve(null);
  }

  findActiveById(): Promise<null> {
    return Promise.resolve(null);
  }

  findActiveForEmail(): Promise<null> {
    return Promise.resolve(null);
  }

  revoke(): Promise<boolean> {
    return Promise.resolve(false);
  }

  accept(): Promise<boolean> {
    return Promise.resolve(false);
  }

  markDelivery(): Promise<void> {
    return Promise.resolve();
  }
}

function fixedClock(): Clock {
  return { now: () => new Date('2026-08-10T00:00:00.000Z') };
}

function inlineTransactions(): TransactionManager {
  return { execute: (operation) => operation() };
}
