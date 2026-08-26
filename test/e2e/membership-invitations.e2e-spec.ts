import { createE2eHarness, type E2eHarness } from './e2e-harness';

describe('Nexora API - Membership Invitations (e2e)', () => {
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
    const repository = h.app.get(h.MembershipInvitationsRepository);

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
