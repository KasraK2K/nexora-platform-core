import { createE2eHarness, type E2eHarness } from './e2e-harness';

describe('Nexora lean multi-workspace core (e2e)', () => {
  let h: E2eHarness;

  beforeAll(async () => {
    h = await createE2eHarness();
  });

  beforeEach(async () => {
    await h.reset();
  });

  afterAll(async () => {
    await h.close();
  });

  it('atomically registers the five-concept account graph and queues verification', async () => {
    const email = 'owner@example.test';
    const response = await h.registerUnverified(email).expect(201);
    const userId = h.readString(response.body, 'data', 'user', 'id');
    const workspaceId = h.readString(response.body, 'data', 'workspace', 'id');

    expect(response.body).toMatchObject({
      data: {
        user: { id: userId, status: 'PENDING_VERIFICATION' },
        workspace: { id: workspaceId, name: 'Main Workspace' },
        membership: { role: 'OWNER' },
      },
      meta: {
        verificationRequired: true,
        verificationEmailQueued: true,
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('organization');
    expect(h.verificationDeliveries).toHaveLength(0);

    await expect(
      h.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    ).resolves.toMatchObject({
      normalizedEmail: email,
      status: 'PENDING_VERIFICATION',
    });
    await expect(
      h.prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } }),
    ).resolves.toMatchObject({ ownerUserId: userId });
    await expect(
      h.prisma.membership.findUniqueOrThrow({
        where: { workspaceId_userId: { workspaceId, userId } },
      }),
    ).resolves.toMatchObject({ removedAt: null });
    await expect(h.prisma.session.findFirstOrThrow()).resolves.toMatchObject({
      userId,
      workspaceId,
      revokedAt: null,
    });
    await expect(
      h.prisma.mailOutboxMessage.findFirstOrThrow(),
    ).resolves.toMatchObject({
      workspaceId,
      purpose: 'EMAIL_VERIFICATION',
      status: 'PENDING',
    });
    expect(await h.prisma.auditLog.count({ where: { workspaceId } })).toBe(2);

    const countsBeforeDuplicate = await Promise.all([
      h.prisma.user.count(),
      h.prisma.workspace.count(),
      h.prisma.membership.count(),
      h.prisma.session.count(),
      h.prisma.emailVerification.count(),
      h.prisma.mailOutboxMessage.count(),
      h.prisma.auditLog.count(),
    ]);
    await h.registerUnverified(email).expect(409);
    await expect(
      Promise.all([
        h.prisma.user.count(),
        h.prisma.workspace.count(),
        h.prisma.membership.count(),
        h.prisma.session.count(),
        h.prisma.emailVerification.count(),
        h.prisma.mailOutboxMessage.count(),
        h.prisma.auditLog.count(),
      ]),
    ).resolves.toEqual(countsBeforeDuplicate);

    await h.drainMail();
    const token = h.readDeliveryToken(h.verificationDeliveries, email);
    await h.confirmEmail(token).expect(204);
    const cookie = h.readCookieHeader(response);
    const current = await h.currentSession(cookie).expect(200);
    expect(current.body).toMatchObject({
      data: {
        user: { id: userId, status: 'ACTIVE' },
        workspace: { id: workspaceId },
        membership: { role: 'OWNER' },
      },
    });
    expect(JSON.stringify(current.body)).not.toContain('organization');
  });

  it('supports independent workspaces, per-workspace invitations, and explicit switching', async () => {
    const owner = await h.register('owner@example.test');
    const ownerCookie = h.readCookieHeader(owner);
    const firstWorkspaceId = h.readString(
      owner.body,
      'data',
      'workspace',
      'id',
    );
    const second = await h.createWorkspace(ownerCookie, 'Second').expect(201);
    const secondWorkspaceId = h.readString(second.body, 'data', 'id');

    const unchanged = await h.currentSession(ownerCookie).expect(200);
    expect(h.readString(unchanged.body, 'data', 'workspace', 'id')).toBe(
      firstWorkspaceId,
    );
    const choices = await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session/workspaces')
      .set('Cookie', ownerCookie)
      .expect(200);
    expect(h.readArray(choices.body, 'data')).toHaveLength(2);
    expect(h.readArray(choices.body, 'data')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workspace: { id: firstWorkspaceId, name: 'Main Workspace' },
          membership: { role: 'OWNER' },
        }),
        expect.objectContaining({
          workspace: { id: secondWorkspaceId, name: 'Second' },
          membership: { role: 'OWNER' },
        }),
      ]),
    );
    expect(JSON.stringify(choices.body)).not.toContain('organization');

    const selection = await h.login('owner@example.test').expect(409);
    expect(h.readString(selection.body, 'error', 'code')).toBe(
      'WORKSPACE_SELECTION_REQUIRED',
    );
    await h
      .login('owner@example.test', h.defaultPassword, secondWorkspaceId)
      .expect(201);

    const member = await h.register('member@example.test');
    const memberCookie = h.readCookieHeader(member);
    const memberOwnedWorkspaceId = h.readString(
      member.body,
      'data',
      'workspace',
      'id',
    );
    const independentMemberLogin = await h
      .login('member@example.test', h.defaultPassword, memberOwnedWorkspaceId)
      .expect(201);
    const independentMemberCookie = h.readCookieHeader(independentMemberLogin);

    const firstInvite = await h.createInvitation(
      ownerCookie,
      'member@example.test',
    );
    expect(firstInvite.status).toBe(201);
    expect(firstInvite.body).toMatchObject({
      data: { role: 'MEMBER', workspaceId: firstWorkspaceId },
      meta: { invitationEmailQueued: true },
    });
    await h
      .createInvitation(ownerCookie, 'member@example.test')
      .then((response) => expect(response.status).toBe(409));
    await h
      .acceptInvitation(
        memberCookie,
        h.readDeliveryToken(h.invitationDeliveries, 'member@example.test'),
      )
      .expect(204);
    expect(
      h.readString(
        (await h.currentSession(memberCookie).expect(200)).body,
        'data',
        'workspace',
        'id',
      ),
    ).toBe(memberOwnedWorkspaceId);

    const switchedOwner = await h
      .switchWorkspace(ownerCookie, secondWorkspaceId)
      .expect(200);
    const secondOwnerCookie = h.readCookieHeader(switchedOwner);
    await h.currentSession(ownerCookie).expect(401);
    const firstOwnerLogin = await h
      .login('owner@example.test', h.defaultPassword, firstWorkspaceId)
      .expect(201);
    const firstOwnerCookie = h.readCookieHeader(firstOwnerLogin);
    const secondInvite = await h.createInvitation(
      secondOwnerCookie,
      'member@example.test',
    );
    expect(secondInvite.status).toBe(201);
    await h
      .acceptInvitation(
        memberCookie,
        h.readDeliveryToken(h.invitationDeliveries, 'member@example.test'),
      )
      .expect(204);

    const switchedMember = await h
      .switchWorkspace(memberCookie, firstWorkspaceId)
      .expect(200);
    const firstMemberCookie = h.readCookieHeader(switchedMember);
    await h
      .request(h.app.getHttpServer())
      .post('/v1/membership-invitations')
      .set('Origin', h.allowedOrigin)
      .set('Cookie', firstMemberCookie)
      .send({ email: 'other@example.test' })
      .expect(403);
    await h
      .request(h.app.getHttpServer())
      .patch('/v1/workspaces/current')
      .set('Origin', h.allowedOrigin)
      .set('Cookie', firstMemberCookie)
      .send({ name: 'Not allowed' })
      .expect(403);

    const members = await h
      .request(h.app.getHttpServer())
      .get('/v1/memberships')
      .set('Cookie', firstOwnerCookie)
      .expect(200);
    const memberItem = h
      .readArray(members.body, 'data')
      .find(
        (item) =>
          typeof item === 'object' &&
          item !== null &&
          'role' in item &&
          item.role === 'MEMBER',
      );
    const membershipId = h.readString(memberItem, 'id');
    const ownerItem = h
      .readArray(members.body, 'data')
      .find(
        (item) =>
          typeof item === 'object' &&
          item !== null &&
          'role' in item &&
          item.role === 'OWNER',
      );
    const ownerMembershipId = h.readString(ownerItem, 'id');

    await h
      .request(h.app.getHttpServer())
      .delete('/v1/memberships/me')
      .set('Origin', h.allowedOrigin)
      .set('Cookie', firstOwnerCookie)
      .expect(409);
    await h
      .request(h.app.getHttpServer())
      .delete(`/v1/memberships/${ownerMembershipId}`)
      .set('Origin', h.allowedOrigin)
      .set('Cookie', firstOwnerCookie)
      .expect(409);
    await h
      .request(h.app.getHttpServer())
      .delete(`/v1/memberships/${membershipId}`)
      .set('Origin', h.allowedOrigin)
      .set('Cookie', secondOwnerCookie)
      .expect(204);
    await expect(
      h.prisma.membership.findUniqueOrThrow({ where: { id: membershipId } }),
    ).resolves.toMatchObject({ removedAt: null });
    await h
      .request(h.app.getHttpServer())
      .delete(`/v1/memberships/${membershipId}`)
      .set('Origin', h.allowedOrigin)
      .set('Cookie', firstOwnerCookie)
      .expect(204);
    await h.currentSession(firstMemberCookie).expect(401);
    await h.currentSession(independentMemberCookie).expect(200);
  });

  it('lets members leave, reactivates their row, and honors invitation revocation', async () => {
    const owner = await h.register('owner@example.test');
    const ownerCookie = h.readCookieHeader(owner);
    const workspaceId = h.readString(owner.body, 'data', 'workspace', 'id');
    const member = await h.register('member@example.test');
    const memberCookie = h.readCookieHeader(member);
    const memberWorkspaceId = h.readString(
      member.body,
      'data',
      'workspace',
      'id',
    );
    const independentLogin = await h
      .login('member@example.test', h.defaultPassword, memberWorkspaceId)
      .expect(201);
    const independentCookie = h.readCookieHeader(independentLogin);

    await h.createInvitation(ownerCookie, 'member@example.test');
    await h
      .acceptInvitation(
        memberCookie,
        h.readDeliveryToken(h.invitationDeliveries, 'member@example.test'),
      )
      .expect(204);
    const membership = await h.prisma.membership.findUniqueOrThrow({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: h.readString(member.body, 'data', 'user', 'id'),
        },
      },
    });
    const switched = await h
      .switchWorkspace(memberCookie, workspaceId)
      .expect(200);
    const workspaceCookie = h.readCookieHeader(switched);
    const leave = await h
      .request(h.app.getHttpServer())
      .delete('/v1/memberships/me')
      .set('Origin', h.allowedOrigin)
      .set('Cookie', workspaceCookie)
      .expect(204);
    expect(h.readSetCookie(leave)).toContain('Max-Age=0');
    await h.currentSession(workspaceCookie).expect(401);
    await h.currentSession(independentCookie).expect(200);
    const removedMembership = await h.prisma.membership.findUniqueOrThrow({
      where: { id: membership.id },
    });
    expect(removedMembership.removedAt).toBeInstanceOf(Date);

    await h.createInvitation(ownerCookie, 'member@example.test');
    await h
      .acceptInvitation(
        independentCookie,
        h.readDeliveryToken(h.invitationDeliveries, 'member@example.test'),
      )
      .expect(204);
    await expect(
      h.prisma.membership.findUniqueOrThrow({
        where: { id: membership.id },
      }),
    ).resolves.toMatchObject({ removedAt: null });

    const invitee = await h.register('revoked@example.test');
    const inviteeCookie = h.readCookieHeader(invitee);
    const invitation = await h.createInvitation(
      ownerCookie,
      'revoked@example.test',
    );
    const invitationId = h.readString(invitation.body, 'data', 'id');
    const invitationToken = h.readDeliveryToken(
      h.invitationDeliveries,
      'revoked@example.test',
    );
    await h
      .request(h.app.getHttpServer())
      .delete(`/v1/membership-invitations/${invitationId}`)
      .set('Origin', h.allowedOrigin)
      .set('Cookie', ownerCookie)
      .expect(204);
    await h.acceptInvitation(inviteeCookie, invitationToken).expect(400);
  });
});
