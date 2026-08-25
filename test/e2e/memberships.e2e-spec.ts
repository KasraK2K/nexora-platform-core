import { createE2eHarness, type E2eHarness } from './e2e-harness';

describe('Nexora API - Memberships (e2e)', () => {
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

  it('applies OWNER, ADMIN, and MEMBER invitation permissions end to end', async () => {
    const owner = await h.register('rbac-owner@example.com');
    const ownerCookie = h.readCookieHeader(owner);
    const ownerWorkspaceId = h.readString(
      owner.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const admin = await h.register('rbac-admin@example.com');
    const adminCookie = h.readCookieHeader(admin);

    const injected = await h
      .request(h.app.getHttpServer())
      .post('/v1/membership-invitations')
      .set('Origin', h.allowedOrigin)
      .set('Cookie', ownerCookie)
      .set('X-Workspace-Id', h.randomUUID())
      .send({
        email: 'rbac-admin@example.com',
        role: 'ADMIN',
        workspaceId: h.randomUUID(),
      });
    expect(injected.status).toBe(400);
    expect(h.invitationDeliveries).toHaveLength(0);

    const issued = await h.createInvitation(
      ownerCookie,
      'RBAC-Admin@Example.com',
      'ADMIN',
    );
    expect(issued.status).toBe(201);
    expect(issued.body).toMatchObject({
      data: {
        workspaceId: ownerWorkspaceId,
        email: 'rbac-admin@example.com',
        role: 'ADMIN',
      },
      meta: { invitationEmailSent: true },
    });
    const adminToken = h.readInvitationToken('rbac-admin@example.com');
    const persisted = await h.prisma.membershipInvitation.findFirstOrThrow();
    expect(persisted.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(persisted.tokenHash).not.toBe(adminToken);
    expect(JSON.stringify(issued.body)).not.toContain(adminToken);

    await h.acceptInvitation(adminCookie, adminToken).expect(204);
    const adminUserId = h.readString(
      admin.body as unknown,
      'data',
      'user',
      'id',
    );
    await expect(
      h.prisma.membership.findUniqueOrThrow({
        where: {
          workspaceId_userId: {
            workspaceId: ownerWorkspaceId,
            userId: adminUserId,
          },
        },
      }),
    ).resolves.toMatchObject({ role: 'ADMIN' });

    const ambiguousAdmin = await h.login('rbac-admin@example.com');
    expect(ambiguousAdmin.status).toBe(409);
    expect(
      h.readArray(
        ambiguousAdmin.body as unknown,
        'error',
        'details',
        'availableWorkspaces',
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ membership: { role: 'ADMIN' } }),
      ]),
    );

    const adminWorkspaces = await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session/workspaces')
      .set('Cookie', adminCookie)
      .expect(200);
    expect(h.readArray(adminWorkspaces.body as unknown, 'data')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ membership: { role: 'ADMIN' } }),
      ]),
    );
    const switchedAdmin = await h.switchWorkspace(
      adminCookie,
      ownerWorkspaceId,
    );
    expect(switchedAdmin.status).toBe(200);
    expect(switchedAdmin.body).toMatchObject({
      data: { membership: { role: 'ADMIN' } },
    });

    const selectedAdmin = await h.login(
      'rbac-admin@example.com',
      'A secure passphrase 123',
      ownerWorkspaceId,
    );
    expect(selectedAdmin.status).toBe(201);
    expect(selectedAdmin.body).toMatchObject({
      data: { membership: { role: 'ADMIN' } },
    });
    const selectedAdminCookie = h.readCookieHeader(selectedAdmin);
    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', selectedAdminCookie)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          data: { membership: { role: 'ADMIN' } },
        }),
      );

    const member = await h.register('rbac-member@example.com');
    const memberCookie = h.readCookieHeader(member);
    const memberInvite = await h.createInvitation(
      selectedAdminCookie,
      'rbac-member@example.com',
      'MEMBER',
    );
    expect(memberInvite.status).toBe(201);
    await h
      .acceptInvitation(
        memberCookie,
        h.readInvitationToken('rbac-member@example.com'),
      )
      .expect(204);

    const selectedMember = await h.login(
      'rbac-member@example.com',
      'A secure passphrase 123',
      ownerWorkspaceId,
    );
    expect(selectedMember.status).toBe(201);
    expect(selectedMember.body).toMatchObject({
      data: { membership: { role: 'MEMBER' } },
    });
    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', h.readCookieHeader(selectedMember))
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          data: { membership: { role: 'MEMBER' } },
        }),
      );
    const memberDenied = await h.createInvitation(
      h.readCookieHeader(selectedMember),
      'someone@example.com',
      'MEMBER',
    );
    expect(memberDenied.status).toBe(403);
    expect(h.readString(memberDenied.body as unknown, 'error', 'code')).toBe(
      'AUTHORIZATION_DENIED',
    );

    const adminEscalationDenied = await h.createInvitation(
      selectedAdminCookie,
      'another@example.com',
      'ADMIN',
    );
    expect(adminEscalationDenied.status).toBe(403);
    expect(
      h.readString(adminEscalationDenied.body as unknown, 'error', 'code'),
    ).toBe('AUTHORIZATION_DENIED');
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

  it('binds invitations to email, invalidates replacements, and rejects stale inviter authority', async () => {
    const owner = await h.register('invitation-owner@example.com');
    const ownerCookie = h.readCookieHeader(owner);
    const ownerUserId = h.readString(
      owner.body as unknown,
      'data',
      'user',
      'id',
    );
    const ownerWorkspaceId = h.readString(
      owner.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const invitee = await h.register('invitation-target@example.com');
    const inviteeCookie = h.readCookieHeader(invitee);
    const wrongUser = await h.register('invitation-wrong@example.com');
    const staleTarget = await h.register('invitation-stale@example.com');

    await h
      .createInvitation(ownerCookie, 'invitation-target@example.com', 'MEMBER')
      .then((response) => expect(response.status).toBe(201));
    const oldToken = h.readInvitationToken('invitation-target@example.com');
    await h
      .createInvitation(ownerCookie, 'invitation-target@example.com', 'MEMBER')
      .then((response) => expect(response.status).toBe(201));
    const replacementToken = h.readInvitationToken(
      'invitation-target@example.com',
      oldToken,
    );

    await h.acceptInvitation(inviteeCookie, oldToken).expect(400);
    await h
      .acceptInvitation(h.readCookieHeader(wrongUser), replacementToken)
      .expect(400);

    const replacement = await h.prisma.membershipInvitation.findFirstOrThrow({
      where: { tokenHash: { not: '0'.repeat(64) }, activeKey: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
    await h
      .request(h.app.getHttpServer())
      .delete(`/v1/membership-invitations/${replacement.id}`)
      .set('Origin', h.allowedOrigin)
      .set('Cookie', h.readCookieHeader(wrongUser))
      .expect(204);
    await expect(
      h.prisma.membershipInvitation.findUniqueOrThrow({
        where: { id: replacement.id },
      }),
    ).resolves.toMatchObject({ revokedAt: null });

    await h
      .request(h.app.getHttpServer())
      .delete(`/v1/membership-invitations/${replacement.id}`)
      .set('Origin', h.allowedOrigin)
      .set('Cookie', ownerCookie)
      .expect(204);
    await h.acceptInvitation(inviteeCookie, replacementToken).expect(400);

    await h
      .createInvitation(ownerCookie, 'invitation-stale@example.com', 'MEMBER')
      .then((response) => expect(response.status).toBe(201));
    const staleToken = h.readInvitationToken('invitation-stale@example.com');

    await h.prisma.membership.update({
      where: {
        workspaceId_userId: {
          workspaceId: ownerWorkspaceId,
          userId: ownerUserId,
        },
      },
      data: { role: 'MEMBER' },
    });
    await h
      .acceptInvitation(h.readCookieHeader(staleTarget), staleToken)
      .expect(400);
    expect(
      await h.prisma.membership.count({
        where: { workspaceId: ownerWorkspaceId },
      }),
    ).toBe(1);
    expect(
      await h.prisma.auditLog.count({
        where: { action: 'membership.invitation.accepted' },
      }),
    ).toBe(0);
  });

  it('allows exactly one concurrent invitation acceptance without switching the current session', async () => {
    const owner = await h.register('invitation-race-owner@example.com');
    const ownerWorkspaceId = h.readString(
      owner.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const invitee = await h.register('invitation-race-target@example.com');
    const inviteeCookie = h.readCookieHeader(invitee);
    const inviteeOriginalWorkspaceId = h.readString(
      invitee.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const inviteeUserId = h.readString(
      invitee.body as unknown,
      'data',
      'user',
      'id',
    );

    await h
      .createInvitation(
        h.readCookieHeader(owner),
        'invitation-race-target@example.com',
        'MEMBER',
      )
      .then((response) => expect(response.status).toBe(201));
    const token = h.readInvitationToken('invitation-race-target@example.com');
    const responses = await Promise.all([
      h.acceptInvitation(inviteeCookie, token),
      h.acceptInvitation(inviteeCookie, token),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([204, 400]);
    expect(
      await h.prisma.membership.count({
        where: { workspaceId: ownerWorkspaceId, userId: inviteeUserId },
      }),
    ).toBe(1);
    expect(
      await h.prisma.auditLog.count({
        where: {
          workspaceId: ownerWorkspaceId,
          actorUserId: inviteeUserId,
          action: 'membership.invitation.accepted',
        },
      }),
    ).toBe(1);

    const current = await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', inviteeCookie)
      .expect(200);
    expect(
      h.readString(current.body as unknown, 'data', 'workspace', 'id'),
    ).toBe(inviteeOriginalWorkspaceId);
  });

  it('allows only one concurrent invitation issue for the same workspace and email', async () => {
    const owner = await h.register('invitation-issue-race-owner@example.com');
    const ownerCookie = h.readCookieHeader(owner);

    const responses = await Promise.all([
      h.createInvitation(
        ownerCookie,
        'invitation-issue-race-target@example.com',
        'MEMBER',
      ),
      h.createInvitation(
        ownerCookie,
        'invitation-issue-race-target@example.com',
        'MEMBER',
      ),
    ]);

    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(h.invitationDeliveries).toHaveLength(1);
    expect(
      await h.prisma.membershipInvitation.count({
        where: { activeKey: { not: null } },
      }),
    ).toBe(1);
    expect(
      await h.prisma.auditLog.count({
        where: { action: 'membership.invitation.created' },
      }),
    ).toBe(1);
  });

  it('keeps a committed invitation when email delivery fails', async () => {
    const owner = await h.register('invitation-delivery-owner@example.com');
    jest
      .spyOn(h.recordingMembershipInvitationSender, 'send')
      .mockRejectedValueOnce(new Error('forced invitation delivery failure'));

    const response = await h.createInvitation(
      h.readCookieHeader(owner),
      'invitation-delivery-target@example.com',
      'MEMBER',
    );

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      meta: { invitationEmailSent: false },
    });
    const persisted = await h.prisma.membershipInvitation.findFirstOrThrow({
      where: { normalizedEmail: 'invitation-delivery-target@example.com' },
    });
    expect(persisted.deliveryStatus).toBe('FAILED');
    expect(typeof persisted.activeKey).toBe('string');
  });

  it('scopes invitation terminal and delivery writes to the trusted workspace', async () => {
    const owner = await h.register('invitation-scope-owner@example.com');
    await h
      .createInvitation(
        h.readCookieHeader(owner),
        'invitation-scope-target@example.com',
        'MEMBER',
      )
      .then((response) => expect(response.status).toBe(201));
    const invitation = await h.prisma.membershipInvitation.findFirstOrThrow({
      where: { normalizedEmail: 'invitation-scope-target@example.com' },
    });
    const repository = h.app.get(h.PrismaMembershipInvitationsRepository);

    await expect(
      repository.accept(
        h.randomUUID(),
        invitation.id,
        h.randomUUID(),
        new Date(),
      ),
    ).resolves.toBe(false);
    await repository.markDelivery(
      h.randomUUID(),
      invitation.id,
      'FAILED',
      new Date(),
    );

    await expect(
      h.prisma.membershipInvitation.findUniqueOrThrow({
        where: { id: invitation.id },
      }),
    ).resolves.toMatchObject({
      acceptedAt: null,
      acceptedByUserId: null,
      deliveryStatus: 'SENT',
    });
  });

  it('rejects expired invitations without membership, audit, or session changes', async () => {
    const owner = await h.register('invitation-expiry-owner@example.com');
    const ownerWorkspaceId = h.readString(
      owner.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const target = await h.register('invitation-expiry-target@example.com');
    const targetCookie = h.readCookieHeader(target);
    const targetUserId = h.readString(
      target.body as unknown,
      'data',
      'user',
      'id',
    );
    const targetWorkspaceId = h.readString(
      target.body as unknown,
      'data',
      'workspace',
      'id',
    );
    await h
      .createInvitation(
        h.readCookieHeader(owner),
        'invitation-expiry-target@example.com',
        'MEMBER',
      )
      .then((response) => expect(response.status).toBe(201));
    const token = h.readInvitationToken('invitation-expiry-target@example.com');
    await h.prisma.membershipInvitation.updateMany({
      where: { normalizedEmail: 'invitation-expiry-target@example.com' },
      data: { expiresAt: new Date('2000-01-01T00:00:00.000Z') },
    });

    await h.acceptInvitation(targetCookie, token).expect(400);
    expect(
      await h.prisma.membership.count({
        where: { workspaceId: ownerWorkspaceId, userId: targetUserId },
      }),
    ).toBe(0);
    expect(
      await h.prisma.auditLog.count({
        where: { action: 'membership.invitation.accepted' },
      }),
    ).toBe(0);
    const current = await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', targetCookie)
      .expect(200);
    expect(
      h.readString(current.body as unknown, 'data', 'workspace', 'id'),
    ).toBe(targetWorkspaceId);
  });

  it('prevents an ADMIN from replacing an OWNER-issued ADMIN invitation', async () => {
    const owner = await h.register('invitation-grant-owner@example.com');
    const ownerCookie = h.readCookieHeader(owner);
    const ownerWorkspaceId = h.readString(
      owner.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const admin = await h.register('invitation-grant-admin@example.com');
    const adminUserId = h.readString(
      admin.body as unknown,
      'data',
      'user',
      'id',
    );
    await h.prisma.membership.create({
      data: {
        id: h.randomUUID(),
        workspaceId: ownerWorkspaceId,
        userId: adminUserId,
        role: 'ADMIN',
      },
    });
    const selectedAdmin = await h.login(
      'invitation-grant-admin@example.com',
      'A secure passphrase 123',
      ownerWorkspaceId,
    );
    const target = await h.register('invitation-grant-target@example.com');

    await h
      .createInvitation(
        ownerCookie,
        'invitation-grant-target@example.com',
        'ADMIN',
      )
      .then((response) => expect(response.status).toBe(201));
    const ownerToken = h.readInvitationToken(
      'invitation-grant-target@example.com',
    );
    await h
      .createInvitation(
        h.readCookieHeader(selectedAdmin),
        'invitation-grant-target@example.com',
        'MEMBER',
      )
      .then((response) => expect(response.status).toBe(403));

    await h
      .acceptInvitation(h.readCookieHeader(target), ownerToken)
      .expect(204);
    const targetUserId = h.readString(
      target.body as unknown,
      'data',
      'user',
      'id',
    );
    await expect(
      h.prisma.membership.findUniqueOrThrow({
        where: {
          workspaceId_userId: {
            workspaceId: ownerWorkspaceId,
            userId: targetUserId,
          },
        },
      }),
    ).resolves.toMatchObject({ role: 'ADMIN' });
  });

  it('rolls back invitation create, accept, and revoke when audit persistence fails', async () => {
    const owner = await h.register('invitation-audit-owner@example.com');
    const ownerCookie = h.readCookieHeader(owner);
    const ownerWorkspaceId = h.readString(
      owner.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const target = await h.register('invitation-audit-target@example.com');
    const targetCookie = h.readCookieHeader(target);
    const targetUserId = h.readString(
      target.body as unknown,
      'data',
      'user',
      'id',
    );
    const append = jest.spyOn(h.auditLog, 'append');

    append.mockRejectedValueOnce(new Error('forced create audit failure'));
    await h
      .createInvitation(
        ownerCookie,
        'invitation-create-audit@example.com',
        'MEMBER',
      )
      .then((response) => expect(response.status).toBe(503));
    expect(await h.prisma.membershipInvitation.count()).toBe(0);
    expect(h.invitationDeliveries).toHaveLength(0);

    await h
      .createInvitation(
        ownerCookie,
        'invitation-audit-target@example.com',
        'MEMBER',
      )
      .then((response) => expect(response.status).toBe(201));
    const token = h.readInvitationToken('invitation-audit-target@example.com');
    const invitation = await h.prisma.membershipInvitation.findFirstOrThrow({
      where: { workspaceId: ownerWorkspaceId, activeKey: { not: null } },
    });

    append.mockRejectedValueOnce(new Error('forced accept audit failure'));
    await h.acceptInvitation(targetCookie, token).expect(503);
    await expect(
      h.prisma.membershipInvitation.findUniqueOrThrow({
        where: { id: invitation.id },
      }),
    ).resolves.toMatchObject({ acceptedAt: null, acceptedByUserId: null });
    expect(
      await h.prisma.membership.count({
        where: { workspaceId: ownerWorkspaceId, userId: targetUserId },
      }),
    ).toBe(0);

    append.mockRejectedValueOnce(new Error('forced revoke audit failure'));
    await h
      .request(h.app.getHttpServer())
      .delete(`/v1/membership-invitations/${invitation.id}`)
      .set('Origin', h.allowedOrigin)
      .set('Cookie', ownerCookie)
      .expect(503);
    const revokeRolledBack =
      await h.prisma.membershipInvitation.findUniqueOrThrow({
        where: { id: invitation.id },
      });
    expect(revokeRolledBack.revokedAt).toBeNull();
    expect(typeof revokeRolledBack.activeKey).toBe('string');
  });

  it('rate-limits invitation creation and acceptance and fails closed when Redis is unavailable', async () => {
    const owner = await h.register('invitation-limit-owner@example.com');
    const ownerCookie = h.readCookieHeader(owner);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await h
        .createInvitation(
          ownerCookie,
          'invitation-limit-target@example.com',
          'MEMBER',
        )
        .then((response) => expect(response.status).toBe(201));
    }
    const limitedCreate = await h.createInvitation(
      ownerCookie,
      'invitation-limit-target@example.com',
      'MEMBER',
    );
    expect(limitedCreate.status).toBe(429);
    expect(h.readString(limitedCreate.body as unknown, 'error', 'code')).toBe(
      'MEMBERSHIP_INVITATION_RATE_LIMITED',
    );
    expect(limitedCreate.headers['retry-after']).toBeDefined();
    expect(h.invitationDeliveries).toHaveLength(5);
    expect(await h.prisma.membershipInvitation.count()).toBe(5);
    expect(
      await h.prisma.auditLog.count({
        where: { action: 'membership.invitation.created' },
      }),
    ).toBe(5);

    const target = await h.register('invitation-limit-accept@example.com');
    const targetCookie = h.readCookieHeader(target);
    await h
      .createInvitation(
        ownerCookie,
        'invitation-limit-accept@example.com',
        'MEMBER',
      )
      .then((response) => expect(response.status).toBe(201));
    const validToken = h.readInvitationToken(
      'invitation-limit-accept@example.com',
    );
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await h.acceptInvitation(targetCookie, 'A'.repeat(43)).expect(400);
    }
    const limitedAccept = await h.acceptInvitation(
      targetCookie,
      'A'.repeat(43),
    );
    expect(limitedAccept.status).toBe(429);
    expect(h.readString(limitedAccept.body as unknown, 'error', 'code')).toBe(
      'MEMBERSHIP_INVITATION_RATE_LIMITED',
    );
    expect(limitedAccept.headers['retry-after']).toBeDefined();
    expect(
      await h.prisma.auditLog.count({
        where: { action: 'membership.invitation.accepted' },
      }),
    ).toBe(0);

    const invitationBeforeAcceptFailure =
      await h.prisma.membershipInvitation.findFirstOrThrow({
        where: { normalizedEmail: 'invitation-limit-accept@example.com' },
      });
    const membershipsBeforeAcceptFailure = await h.prisma.membership.count();
    const auditsBeforeAcceptFailure = await h.prisma.auditLog.count();
    jest
      .spyOn(h.membershipInvitationRateLimiter, 'checkAccept')
      .mockRejectedValueOnce(new Error('forced Redis failure'));
    await h.acceptInvitation(targetCookie, validToken).expect(503);
    await expect(
      h.prisma.membershipInvitation.findUniqueOrThrow({
        where: { id: invitationBeforeAcceptFailure.id },
      }),
    ).resolves.toMatchObject({ acceptedAt: null, acceptedByUserId: null });
    expect(await h.prisma.membership.count()).toBe(
      membershipsBeforeAcceptFailure,
    );
    expect(await h.prisma.auditLog.count()).toBe(auditsBeforeAcceptFailure);

    const invitationsBeforeFailure =
      await h.prisma.membershipInvitation.count();
    const deliveriesBeforeFailure = h.invitationDeliveries.length;
    const auditsBeforeFailure = await h.prisma.auditLog.count();
    jest
      .spyOn(h.membershipInvitationRateLimiter, 'checkCreate')
      .mockRejectedValueOnce(new Error('forced Redis failure'));
    await h
      .createInvitation(
        ownerCookie,
        'invitation-limit-redis@example.com',
        'MEMBER',
      )
      .then((response) => expect(response.status).toBe(503));
    expect(await h.prisma.membershipInvitation.count()).toBe(
      invitationsBeforeFailure,
    );
    expect(await h.prisma.auditLog.count()).toBe(auditsBeforeFailure);
    expect(h.invitationDeliveries).toHaveLength(deliveriesBeforeFailure);
  });
});
