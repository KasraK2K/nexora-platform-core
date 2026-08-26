import { createE2eHarness, type E2eHarness } from './e2e-harness';

describe('Nexora API - Membership Administration (e2e)', () => {
  let h: E2eHarness;

  beforeAll(async () => {
    h = await createE2eHarness();
  });

  beforeEach(async () => {
    await h.reset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await h.close();
  });

  it('administers active-workspace memberships with tenant isolation and scoped session revocation', async () => {
    const owner = await h.register('membership-admin-owner@example.com');
    const ownerCookie = h.readCookieHeader(owner);
    const ownerWorkspaceId = h.readString(
      owner.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const ownerMembership = await h.prisma.membership.findFirstOrThrow({
      where: { workspaceId: ownerWorkspaceId, role: 'OWNER' },
    });
    const admin = await h.register('membership-admin-admin@example.com');
    const adminHomeCookie = h.readCookieHeader(admin);
    const member = await h.register('membership-admin-member@example.com');
    const memberHomeCookie = h.readCookieHeader(member);

    await h
      .createInvitation(
        ownerCookie,
        'membership-admin-admin@example.com',
        'ADMIN',
      )
      .expect(201);
    await h
      .acceptInvitation(
        adminHomeCookie,
        h.readInvitationToken('membership-admin-admin@example.com'),
      )
      .expect(204);
    await h
      .createInvitation(
        ownerCookie,
        'membership-admin-member@example.com',
        'MEMBER',
      )
      .expect(201);
    await h
      .acceptInvitation(
        memberHomeCookie,
        h.readInvitationToken('membership-admin-member@example.com'),
      )
      .expect(204);

    const adminUserId = h.readString(
      admin.body as unknown,
      'data',
      'user',
      'id',
    );
    const memberUserId = h.readString(
      member.body as unknown,
      'data',
      'user',
      'id',
    );
    const adminMembership = await h.prisma.membership.findUniqueOrThrow({
      where: {
        workspaceId_userId: {
          workspaceId: ownerWorkspaceId,
          userId: adminUserId,
        },
      },
    });
    const memberMembership = await h.prisma.membership.findUniqueOrThrow({
      where: {
        workspaceId_userId: {
          workspaceId: ownerWorkspaceId,
          userId: memberUserId,
        },
      },
    });
    const selectedAdmin = await h.login(
      'membership-admin-admin@example.com',
      'A secure passphrase 123',
      ownerWorkspaceId,
    );
    const selectedAdminCookie = h.readCookieHeader(selectedAdmin);
    const selectedMember = await h.login(
      'membership-admin-member@example.com',
      'A secure passphrase 123',
      ownerWorkspaceId,
    );
    const secondSelectedMember = await h.login(
      'membership-admin-member@example.com',
      'A secure passphrase 123',
      ownerWorkspaceId,
    );

    const firstPage = await h
      .request(h.app.getHttpServer())
      .get('/v1/memberships?limit=2')
      .set('Cookie', ownerCookie)
      .expect(200);
    const nextCursor = h.readString(
      firstPage.body as unknown,
      'meta',
      'nextCursor',
    );
    const secondPage = await h
      .request(h.app.getHttpServer())
      .get(`/v1/memberships?limit=2&cursor=${nextCursor}`)
      .set('Cookie', ownerCookie)
      .expect(200);
    expect([
      ...h.readArray(firstPage.body as unknown, 'data'),
      ...h.readArray(secondPage.body as unknown, 'data'),
    ]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: ownerMembership.id, role: 'OWNER' }),
        expect.objectContaining({ id: adminMembership.id, role: 'ADMIN' }),
        expect.objectContaining({ id: memberMembership.id, role: 'MEMBER' }),
      ]),
    );
    await h
      .request(h.app.getHttpServer())
      .get('/v1/memberships')
      .set('Cookie', h.readCookieHeader(selectedMember))
      .expect(403);

    await h
      .request(h.app.getHttpServer())
      .patch(`/v1/memberships/${adminMembership.id}/role`)
      .set('Origin', h.allowedOrigin)
      .set('Cookie', ownerCookie)
      .send({ role: 'MEMBER', workspaceId: h.randomUUID() })
      .expect(400);
    await h
      .changeMembershipRole(ownerCookie, ownerMembership.id, 'MEMBER')
      .expect(409);

    const foreign = await h.register('membership-admin-foreign@example.com');
    const foreignWorkspaceId = h.readString(
      foreign.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const foreignMembership = await h.prisma.membership.findFirstOrThrow({
      where: { workspaceId: foreignWorkspaceId },
    });
    await h
      .changeMembershipRole(ownerCookie, foreignMembership.id, 'MEMBER')
      .expect(204);
    await h
      .removeWorkspaceMembership(ownerCookie, foreignMembership.id)
      .expect(204);
    await h
      .request(h.app.getHttpServer())
      .get(`/v1/memberships?cursor=${foreignMembership.id}`)
      .set('Cookie', ownerCookie)
      .expect(400);
    expect(
      await h.prisma.membership.findUniqueOrThrow({
        where: { id: foreignMembership.id },
      }),
    ).toMatchObject({ removedAt: null, role: 'OWNER' });

    await h
      .changeMembershipRole(ownerCookie, adminMembership.id, 'MEMBER')
      .expect(204);
    await h
      .request(h.app.getHttpServer())
      .get('/v1/memberships')
      .set('Cookie', selectedAdminCookie)
      .expect(403);
    await h
      .changeMembershipRole(ownerCookie, adminMembership.id, 'ADMIN')
      .expect(204);
    await h
      .request(h.app.getHttpServer())
      .get('/v1/memberships')
      .set('Cookie', selectedAdminCookie)
      .expect(200);

    await h
      .removeWorkspaceMembership(selectedAdminCookie, memberMembership.id)
      .expect(204);
    const removedMembership = await h.prisma.membership.findUniqueOrThrow({
      where: { id: memberMembership.id },
    });
    expect(removedMembership.removedAt).toBeInstanceOf(Date);
    expect(
      await h.prisma.session.count({
        where: {
          userId: memberUserId,
          activeWorkspaceId: ownerWorkspaceId,
          revokedAt: { not: null },
        },
      }),
    ).toBe(2);
    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', h.readCookieHeader(selectedMember))
      .expect(401);
    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', h.readCookieHeader(secondSelectedMember))
      .expect(401);
    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', memberHomeCookie)
      .expect(200);

    await h
      .createInvitation(
        ownerCookie,
        'membership-admin-member@example.com',
        'MEMBER',
      )
      .expect(201);
    await h
      .acceptInvitation(
        memberHomeCookie,
        h.readInvitationToken('membership-admin-member@example.com'),
      )
      .expect(204);
    expect(
      await h.prisma.membership.findUniqueOrThrow({
        where: { id: memberMembership.id },
      }),
    ).toMatchObject({ removedAt: null, role: 'MEMBER' });
    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', h.readCookieHeader(selectedMember))
      .expect(401);
    await h
      .login(
        'membership-admin-member@example.com',
        'A secure passphrase 123',
        ownerWorkspaceId,
      )
      .then((response) => expect(response.status).toBe(201));
  });

  it('updates the actor profile and lets only OWNER or ADMIN rename the active workspace', async () => {
    const owner = await h.register('lifecycle-owner@example.com');
    const ownerCookie = h.readCookieHeader(owner);
    const ownerUserId = h.readString(
      owner.body as unknown,
      'data',
      'user',
      'id',
    );
    const workspaceId = h.readString(
      owner.body as unknown,
      'data',
      'workspace',
      'id',
    );

    await h
      .updateOwnProfile(ownerCookie, {
        displayName: 'Injected Name',
        userId: h.randomUUID(),
      })
      .expect(400);
    await h
      .request(h.app.getHttpServer())
      .patch('/v1/users/me')
      .set('Cookie', ownerCookie)
      .send({ displayName: 'Missing Origin' })
      .expect(403);
    await h
      .updateOwnProfile(ownerCookie, {
        displayName: '  Updated Owner  ',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          data: { id: ownerUserId, displayName: 'Updated Owner' },
          meta: {},
        });
      });
    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', ownerCookie)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          data: { user: { id: ownerUserId, displayName: 'Updated Owner' } },
        });
      });
    expect(
      await h.prisma.auditLog.count({
        where: {
          workspaceId,
          actorUserId: ownerUserId,
          action: 'user.profile.updated',
        },
      }),
    ).toBe(1);

    await h
      .renameCurrentWorkspace(ownerCookie, {
        name: 'Injected Workspace',
        workspaceId: h.randomUUID(),
      })
      .expect(400);
    await h
      .renameCurrentWorkspace(ownerCookie, {
        name: '  Renamed Workspace  ',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          data: { id: workspaceId, name: 'Renamed Workspace' },
          meta: {},
        });
      });
    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', ownerCookie)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          data: { workspace: { id: workspaceId, name: 'Renamed Workspace' } },
        });
      });

    const collaborator = await h.register('lifecycle-collaborator@example.com');
    const collaboratorHomeCookie = h.readCookieHeader(collaborator);
    const collaboratorUserId = h.readString(
      collaborator.body as unknown,
      'data',
      'user',
      'id',
    );
    await h
      .createInvitation(
        ownerCookie,
        'lifecycle-collaborator@example.com',
        'MEMBER',
      )
      .expect(201);
    await h
      .acceptInvitation(
        collaboratorHomeCookie,
        h.readInvitationToken('lifecycle-collaborator@example.com'),
      )
      .expect(204);
    const collaboratorSession = await h.login(
      'lifecycle-collaborator@example.com',
      'A secure passphrase 123',
      workspaceId,
    );
    const collaboratorCookie = h.readCookieHeader(collaboratorSession);
    await h
      .renameCurrentWorkspace(collaboratorCookie, {
        name: 'Member Rename',
      })
      .expect(403);
    const collaboratorMembership = await h.prisma.membership.findUniqueOrThrow({
      where: {
        workspaceId_userId: { workspaceId, userId: collaboratorUserId },
      },
    });
    await h
      .changeMembershipRole(ownerCookie, collaboratorMembership.id, 'ADMIN')
      .expect(204);
    await h
      .renameCurrentWorkspace(collaboratorCookie, {
        name: 'Admin Rename',
      })
      .expect(200);
    expect(
      await h.prisma.auditLog.count({
        where: { workspaceId, action: 'workspace.renamed' },
      }),
    ).toBe(2);

    await h
      .updateOwnProfile(collaboratorCookie, {
        displayName: 'Updated Collaborator',
      })
      .expect(200);
    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', collaboratorHomeCookie)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          data: { user: { displayName: 'Updated Collaborator' } },
        });
      });
  });

  it('leaves only the active workspace, revokes its sessions, and clears the presented cookie', async () => {
    const owner = await h.register('leave-owner@example.com');
    const ownerCookie = h.readCookieHeader(owner);
    const workspaceId = h.readString(
      owner.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const member = await h.register('leave-member@example.com');
    const memberHomeCookie = h.readCookieHeader(member);
    const memberUserId = h.readString(
      member.body as unknown,
      'data',
      'user',
      'id',
    );
    await h
      .createInvitation(ownerCookie, 'leave-member@example.com', 'MEMBER')
      .expect(201);
    await h
      .acceptInvitation(
        memberHomeCookie,
        h.readInvitationToken('leave-member@example.com'),
      )
      .expect(204);
    const firstSelected = await h.login(
      'leave-member@example.com',
      'A secure passphrase 123',
      workspaceId,
    );
    const secondSelected = await h.login(
      'leave-member@example.com',
      'A secure passphrase 123',
      workspaceId,
    );
    const firstSelectedCookie = h.readCookieHeader(firstSelected);
    const secondSelectedCookie = h.readCookieHeader(secondSelected);

    await h
      .request(h.app.getHttpServer())
      .delete('/v1/memberships/me')
      .set('Cookie', firstSelectedCookie)
      .expect(403);
    await h
      .request(h.app.getHttpServer())
      .delete('/v1/memberships/me')
      .set('Origin', h.allowedOrigin)
      .set('Cookie', firstSelectedCookie)
      .send({ workspaceId: h.randomUUID() })
      .expect(400);
    const removeCachedSession = jest
      .spyOn(h.sessionCache, 'remove')
      .mockRejectedValue(new Error('forced'));
    const leaveResponse = await h.leaveCurrentWorkspace(firstSelectedCookie);
    expect(leaveResponse.status).toBe(204);
    expect(removeCachedSession).toHaveBeenCalled();
    expect(h.readSetCookie(leaveResponse)).toContain('Max-Age=0');
    const leftMembership = await h.prisma.membership.findUniqueOrThrow({
      where: { workspaceId_userId: { workspaceId, userId: memberUserId } },
    });
    expect(leftMembership.removedAt).toBeInstanceOf(Date);
    expect(
      await h.prisma.session.count({
        where: {
          userId: memberUserId,
          activeWorkspaceId: workspaceId,
          revokedAt: { not: null },
        },
      }),
    ).toBe(2);
    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', firstSelectedCookie)
      .expect(401);
    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', secondSelectedCookie)
      .expect(401);
    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', memberHomeCookie)
      .expect(200);
    expect(
      await h.prisma.auditLog.count({
        where: {
          workspaceId,
          actorUserId: memberUserId,
          action: 'membership.left',
        },
      }),
    ).toBe(1);

    await h
      .leaveCurrentWorkspace(ownerCookie)
      .expect(409)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          error: { code: 'MEMBERSHIP_OWNERSHIP_PROTECTED' },
        });
      });
  });

  it('keeps one active membership when the final two workspace leaves race', async () => {
    const actor = await h.register('leave-race-actor@example.com');
    const actorCookie = h.readCookieHeader(actor);
    const actorUserId = h.readString(
      actor.body as unknown,
      'data',
      'user',
      'id',
    );
    const actorWorkspaceId = h.readString(
      actor.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const successor = await h.register('leave-race-successor@example.com');
    const successorCookie = h.readCookieHeader(successor);
    const successorUserId = h.readString(
      successor.body as unknown,
      'data',
      'user',
      'id',
    );
    await h
      .createInvitation(
        actorCookie,
        'leave-race-successor@example.com',
        'MEMBER',
      )
      .expect(201);
    await h
      .acceptInvitation(
        successorCookie,
        h.readInvitationToken('leave-race-successor@example.com'),
      )
      .expect(204);
    const successorMembership = await h.prisma.membership.findUniqueOrThrow({
      where: {
        workspaceId_userId: {
          workspaceId: actorWorkspaceId,
          userId: successorUserId,
        },
      },
    });
    await h
      .transferWorkspaceOwner(
        actorCookie,
        successorMembership.id,
        'A secure passphrase 123',
      )
      .expect(204);

    const secondOwner = await h.register('leave-race-owner@example.com');
    const secondOwnerCookie = h.readCookieHeader(secondOwner);
    const secondWorkspaceId = h.readString(
      secondOwner.body as unknown,
      'data',
      'workspace',
      'id',
    );
    await h
      .createInvitation(
        secondOwnerCookie,
        'leave-race-actor@example.com',
        'MEMBER',
      )
      .expect(201);
    await h
      .acceptInvitation(
        actorCookie,
        h.readInvitationToken('leave-race-actor@example.com'),
      )
      .expect(204);
    const secondWorkspaceSession = await h.login(
      'leave-race-actor@example.com',
      'A secure passphrase 123',
      secondWorkspaceId,
    );

    const responses = await Promise.all([
      h.leaveCurrentWorkspace(actorCookie),
      h.leaveCurrentWorkspace(h.readCookieHeader(secondWorkspaceSession)),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([204, 409]);
    const activeMemberships = await h.prisma.membership.findMany({
      where: { userId: actorUserId, removedAt: null },
    });
    expect(activeMemberships).toHaveLength(1);
    expect(
      await h.prisma.auditLog.count({
        where: { actorUserId, action: 'membership.left' },
      }),
    ).toBe(1);
  });

  it('rolls back lifecycle mutations when audit persistence fails', async () => {
    const owner = await h.register('lifecycle-audit-owner@example.com');
    const ownerCookie = h.readCookieHeader(owner);
    const ownerUserId = h.readString(
      owner.body as unknown,
      'data',
      'user',
      'id',
    );
    const workspaceId = h.readString(
      owner.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const appendAudit = jest.spyOn(h.auditLog, 'append');

    appendAudit.mockRejectedValueOnce(
      new Error('forced profile audit failure'),
    );
    await h
      .updateOwnProfile(ownerCookie, { displayName: 'Must Roll Back' })
      .expect(503)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          error: { code: 'USER_LIFECYCLE_UNAVAILABLE' },
        });
      });
    expect(
      await h.prisma.user.findUniqueOrThrow({ where: { id: ownerUserId } }),
    ).toMatchObject({ displayName: 'Owner' });

    appendAudit.mockRejectedValueOnce(
      new Error('forced workspace audit failure'),
    );
    await h
      .renameCurrentWorkspace(ownerCookie, { name: 'Must Roll Back' })
      .expect(503)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          error: { code: 'WORKSPACE_LIFECYCLE_UNAVAILABLE' },
        });
      });
    expect(
      await h.prisma.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
      }),
    ).toMatchObject({ name: 'Main Workspace' });

    const member = await h.register('lifecycle-audit-member@example.com');
    const memberCookie = h.readCookieHeader(member);
    const memberUserId = h.readString(
      member.body as unknown,
      'data',
      'user',
      'id',
    );
    await h
      .createInvitation(
        ownerCookie,
        'lifecycle-audit-member@example.com',
        'MEMBER',
      )
      .expect(201);
    await h
      .acceptInvitation(
        memberCookie,
        h.readInvitationToken('lifecycle-audit-member@example.com'),
      )
      .expect(204);
    const selectedMember = await h.login(
      'lifecycle-audit-member@example.com',
      'A secure passphrase 123',
      workspaceId,
    );
    const selectedMemberCookie = h.readCookieHeader(selectedMember);
    appendAudit.mockRejectedValueOnce(new Error('forced leave audit failure'));
    await h
      .leaveCurrentWorkspace(selectedMemberCookie)
      .expect(503)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          error: { code: 'MEMBERSHIP_ADMINISTRATION_UNAVAILABLE' },
        });
      });
    expect(
      await h.prisma.membership.findUniqueOrThrow({
        where: { workspaceId_userId: { workspaceId, userId: memberUserId } },
      }),
    ).toMatchObject({ removedAt: null });
    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', selectedMemberCookie)
      .expect(200);
  });

  it('transfers workspace ownership only with step-up confirmation and preserves commercial ownership', async () => {
    const ownershipPassword = '\u{1F510}'.repeat(65);
    const owner = await h.registerWithPassword(
      'ownership-owner@example.com',
      ownershipPassword,
    );
    const ownerCookie = h.readCookieHeader(owner);
    const ownerUserId = h.readString(
      owner.body as unknown,
      'data',
      'user',
      'id',
    );
    const organizationId = h.readString(
      owner.body as unknown,
      'data',
      'organization',
      'id',
    );
    const workspaceId = h.readString(
      owner.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const target = await h.register('ownership-target@example.com');
    const targetHomeCookie = h.readCookieHeader(target);
    const targetUserId = h.readString(
      target.body as unknown,
      'data',
      'user',
      'id',
    );
    await h
      .createInvitation(ownerCookie, 'ownership-target@example.com', 'ADMIN')
      .expect(201);
    await h
      .acceptInvitation(
        targetHomeCookie,
        h.readInvitationToken('ownership-target@example.com'),
      )
      .expect(204);
    const targetMembership = await h.prisma.membership.findUniqueOrThrow({
      where: {
        workspaceId_userId: { workspaceId, userId: targetUserId },
      },
    });
    const ownerMembership = await h.prisma.membership.findUniqueOrThrow({
      where: {
        workspaceId_userId: { workspaceId, userId: ownerUserId },
      },
    });

    await h
      .changeMembershipRole(ownerCookie, ownerMembership.id, 'MEMBER')
      .expect(409);
    await h
      .removeWorkspaceMembership(ownerCookie, ownerMembership.id)
      .expect(409);
    jest
      .spyOn(h.membershipOwnershipTransferRateLimiter, 'check')
      .mockRejectedValueOnce(new Error('forced rate limiter outage'));
    await h
      .transferWorkspaceOwner(
        ownerCookie,
        targetMembership.id,
        ownershipPassword,
      )
      .expect(503);
    await h
      .transferWorkspaceOwner(
        ownerCookie,
        targetMembership.id,
        'wrong password',
      )
      .expect(400);
    expect(
      await h.prisma.membership.count({
        where: { workspaceId, role: 'OWNER', removedAt: null },
      }),
    ).toBe(1);

    const selectedTarget = await h.login(
      'ownership-target@example.com',
      'A secure passphrase 123',
      workspaceId,
    );
    await h
      .transferWorkspaceOwner(
        ownerCookie,
        targetMembership.id,
        ownershipPassword,
      )
      .expect(204);

    expect(
      await h.prisma.membership.findUniqueOrThrow({
        where: { id: ownerMembership.id },
      }),
    ).toMatchObject({ role: 'ADMIN', removedAt: null });
    expect(
      await h.prisma.membership.findUniqueOrThrow({
        where: { id: targetMembership.id },
      }),
    ).toMatchObject({ role: 'OWNER', removedAt: null });
    expect(
      await h.prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
      }),
    ).toMatchObject({ ownerUserId });
    expect(
      await h.prisma.auditLog.count({
        where: {
          workspaceId,
          action: 'membership.ownership.transferred',
          resourceId: targetMembership.id,
        },
      }),
    ).toBe(1);

    await h
      .transferWorkspaceOwner(
        ownerCookie,
        targetMembership.id,
        ownershipPassword,
      )
      .expect(403);
    await h
      .changeMembershipRole(
        h.readCookieHeader(selectedTarget),
        ownerMembership.id,
        'MEMBER',
      )
      .expect(204);
  });

  it('returns a stable ownership-transfer rate-limit response', async () => {
    const owner = await h.register('ownership-rate-limit@example.com');
    jest
      .spyOn(h.membershipOwnershipTransferRateLimiter, 'check')
      .mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 37 });

    const response = await h.transferWorkspaceOwner(
      h.readCookieHeader(owner),
      h.randomUUID(),
      'A secure passphrase 123',
    );

    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toBe('37');
    expect(response.body).toMatchObject({
      error: {
        code: 'MEMBERSHIP_OWNERSHIP_TRANSFER_RATE_LIMITED',
        message: 'Too many workspace ownership transfer attempts.',
        retryable: true,
      },
    });
  });

  it('rolls back role and removal mutations when audit persistence fails', async () => {
    const owner = await h.register('membership-audit-owner@example.com');
    const ownerCookie = h.readCookieHeader(owner);
    const workspaceId = h.readString(
      owner.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const target = await h.register('membership-audit-target@example.com');
    const targetHomeCookie = h.readCookieHeader(target);
    const targetUserId = h.readString(
      target.body as unknown,
      'data',
      'user',
      'id',
    );
    await h
      .createInvitation(
        ownerCookie,
        'membership-audit-target@example.com',
        'MEMBER',
      )
      .expect(201);
    await h
      .acceptInvitation(
        targetHomeCookie,
        h.readInvitationToken('membership-audit-target@example.com'),
      )
      .expect(204);
    const targetMembership = await h.prisma.membership.findUniqueOrThrow({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });
    const selectedTarget = await h.login(
      'membership-audit-target@example.com',
      'A secure passphrase 123',
      workspaceId,
    );

    const appendAudit = jest.spyOn(h.auditLog, 'append');
    appendAudit.mockRejectedValueOnce(new Error('forced'));
    await h
      .changeMembershipRole(ownerCookie, targetMembership.id, 'ADMIN')
      .expect(503);
    expect(
      await h.prisma.membership.findUniqueOrThrow({
        where: { id: targetMembership.id },
      }),
    ).toMatchObject({ role: 'MEMBER', removedAt: null });

    appendAudit.mockRejectedValueOnce(new Error('forced'));
    await h
      .removeWorkspaceMembership(ownerCookie, targetMembership.id)
      .expect(503);
    expect(
      await h.prisma.membership.findUniqueOrThrow({
        where: { id: targetMembership.id },
      }),
    ).toMatchObject({ role: 'MEMBER', removedAt: null });
    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', h.readCookieHeader(selectedTarget))
      .expect(200);
  });

  it('allows exactly one concurrent workspace ownership transfer and rolls back on audit failure', async () => {
    const owner = await h.register('ownership-race-owner@example.com');
    const ownerCookie = h.readCookieHeader(owner);
    const workspaceId = h.readString(
      owner.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const targetA = await h.register('ownership-race-a@example.com');
    const targetB = await h.register('ownership-race-b@example.com');
    for (const [target, email] of [
      [targetA, 'ownership-race-a@example.com'],
      [targetB, 'ownership-race-b@example.com'],
    ] as const) {
      await h.createInvitation(ownerCookie, email, 'ADMIN').expect(201);
      await h
        .acceptInvitation(
          h.readCookieHeader(target),
          h.readInvitationToken(email),
        )
        .expect(204);
    }
    const targetMemberships = await h.prisma.membership.findMany({
      where: { workspaceId, role: 'ADMIN', removedAt: null },
      orderBy: { id: 'asc' },
    });

    const responses = await Promise.all(
      targetMemberships.map((membership) =>
        h.transferWorkspaceOwner(
          ownerCookie,
          membership.id,
          'A secure passphrase 123',
        ),
      ),
    );
    expect(responses.map(({ status }) => status).sort()).toEqual([204, 403]);
    expect(
      await h.prisma.membership.count({
        where: { workspaceId, role: 'OWNER', removedAt: null },
      }),
    ).toBe(1);
    expect(
      await h.prisma.auditLog.count({
        where: { workspaceId, action: 'membership.ownership.transferred' },
      }),
    ).toBe(1);

    await h.clearRegistrationData(h.prisma);
    await h.redis.client.flushDb();
    const rollbackOwner = await h.register(
      'ownership-rollback-owner@example.com',
    );
    const rollbackTarget = await h.register(
      'ownership-rollback-target@example.com',
    );
    await h
      .createInvitation(
        h.readCookieHeader(rollbackOwner),
        'ownership-rollback-target@example.com',
        'MEMBER',
      )
      .expect(201);
    await h
      .acceptInvitation(
        h.readCookieHeader(rollbackTarget),
        h.readInvitationToken('ownership-rollback-target@example.com'),
      )
      .expect(204);
    const rollbackWorkspaceId = h.readString(
      rollbackOwner.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const rollbackTargetUserId = h.readString(
      rollbackTarget.body as unknown,
      'data',
      'user',
      'id',
    );
    const rollbackTargetMembership =
      await h.prisma.membership.findUniqueOrThrow({
        where: {
          workspaceId_userId: {
            workspaceId: rollbackWorkspaceId,
            userId: rollbackTargetUserId,
          },
        },
      });
    jest.spyOn(h.auditLog, 'append').mockRejectedValueOnce(new Error('forced'));
    await h
      .transferWorkspaceOwner(
        h.readCookieHeader(rollbackOwner),
        rollbackTargetMembership.id,
        'A secure passphrase 123',
      )
      .expect(503);
    expect(
      await h.prisma.membership.count({
        where: {
          workspaceId: rollbackWorkspaceId,
          role: 'OWNER',
          removedAt: null,
        },
      }),
    ).toBe(1);
    expect(
      await h.prisma.membership.findUniqueOrThrow({
        where: { id: rollbackTargetMembership.id },
      }),
    ).toMatchObject({ role: 'MEMBER' });
  });
});
