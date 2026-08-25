import { createE2eHarness, type E2eHarness } from './e2e-harness';

describe('Nexora API - Tenancy Reliability (e2e)', () => {
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

  it('enforces the tenant-isolation matrix for HTTP reads and resource mutations', async () => {
    const tenantA = await h.register('tenant-matrix-http-a@example.com');
    const tenantB = await h.register('tenant-matrix-http-b@example.com');
    const tenantBMember = await h.register(
      'tenant-matrix-http-b-member@example.com',
    );
    const cookieA = h.readCookieHeader(tenantA);
    const userA = h.readString(tenantA.body as unknown, 'data', 'user', 'id');
    const userB = h.readString(tenantB.body as unknown, 'data', 'user', 'id');
    const userBMember = h.readString(
      tenantBMember.body as unknown,
      'data',
      'user',
      'id',
    );
    const workspaceA = h.readString(
      tenantA.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const workspaceB = h.readString(
      tenantB.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const organizationB = h.readString(
      tenantB.body as unknown,
      'data',
      'organization',
      'id',
    );
    const membershipB = await h.prisma.membership.findUniqueOrThrow({
      where: { workspaceId_userId: { workspaceId: workspaceB, userId: userB } },
    });
    const membershipBMemberId = h.randomUUID();
    await h.prisma.membership.create({
      data: {
        id: membershipBMemberId,
        workspaceId: workspaceB,
        userId: userBMember,
        role: 'MEMBER',
      },
    });
    const invitationBId = h.randomUUID();
    const invitationBActiveKey = 'b'.repeat(64);
    await h.prisma.membershipInvitation.create({
      data: {
        id: invitationBId,
        workspaceId: workspaceB,
        invitedByUserId: userB,
        normalizedEmail: 'tenant-matrix-http-target@example.com',
        role: 'MEMBER',
        tokenHash: 'c'.repeat(64),
        activeKey: invitationBActiveKey,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const forgedHeaders = {
      'X-User-Id': userB,
      'X-Workspace-Id': workspaceB,
      'X-Membership-Role': 'OWNER',
    };
    const sessionCountBeforeForeignLogin = await h.prisma.session.count();
    const auditCountBeforeForeignLogin = await h.prisma.auditLog.count();
    await h
      .login(
        'tenant-matrix-http-a@example.com',
        'A secure passphrase 123',
        workspaceB,
      )
      .then((response) => expect(response.status).toBe(401));
    expect(await h.prisma.session.count()).toBe(sessionCountBeforeForeignLogin);
    expect(await h.prisma.auditLog.count()).toBe(auditCountBeforeForeignLogin);

    const current = await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', cookieA)
      .set(forgedHeaders)
      .expect(200);
    expect(h.readString(current.body as unknown, 'data', 'user', 'id')).toBe(
      userA,
    );
    expect(
      h.readString(current.body as unknown, 'data', 'workspace', 'id'),
    ).toBe(workspaceA);

    const workspaces = await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session/workspaces')
      .set('Cookie', cookieA)
      .set(forgedHeaders)
      .expect(200);
    expect(
      h
        .readArray(workspaces.body as unknown, 'data')
        .map((entry) => h.readString(entry, 'workspace', 'id')),
    ).toEqual([workspaceA]);

    const memberships = await h
      .request(h.app.getHttpServer())
      .get('/v1/memberships')
      .set('Cookie', cookieA)
      .set(forgedHeaders)
      .expect(200);
    const visibleMembershipIds = h
      .readArray(memberships.body as unknown, 'data')
      .map((entry) => h.readString(entry, 'id'));
    expect(visibleMembershipIds).not.toContain(membershipB.id);
    expect(visibleMembershipIds).not.toContain(membershipBMemberId);
    expect(visibleMembershipIds).toHaveLength(1);

    await h
      .switchWorkspace(cookieA, workspaceB)
      .expect(403)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          error: { code: 'WORKSPACE_ACCESS_DENIED' },
        });
      });
    await h
      .request(h.app.getHttpServer())
      .get(`/v1/memberships?cursor=${membershipBMemberId}`)
      .set('Cookie', cookieA)
      .set(forgedHeaders)
      .expect(400);
    await h
      .changeMembershipRole(cookieA, membershipBMemberId, 'ADMIN')
      .expect(204);
    await h.removeWorkspaceMembership(cookieA, membershipBMemberId).expect(204);
    await h
      .transferWorkspaceOwner(
        cookieA,
        membershipBMemberId,
        'A secure passphrase 123',
      )
      .expect(400);
    await h
      .request(h.app.getHttpServer())
      .delete(`/v1/membership-invitations/${invitationBId}`)
      .set('Origin', h.allowedOrigin)
      .set('Cookie', cookieA)
      .set(forgedHeaders)
      .expect(204);

    await h
      .updateOwnProfile(cookieA, { displayName: 'Tenant A Actor' })
      .set(forgedHeaders)
      .expect(200);
    await h
      .renameCurrentWorkspace(cookieA, { name: 'Tenant A Renamed' })
      .set(forgedHeaders)
      .expect(200);
    await h
      .request(h.app.getHttpServer())
      .post('/v1/membership-invitations')
      .set('Origin', h.allowedOrigin)
      .set('Cookie', cookieA)
      .set(forgedHeaders)
      .send({
        email: 'tenant-matrix-http-target@example.com',
        role: 'MEMBER',
      })
      .expect(201);

    await expect(
      h.prisma.user.findUniqueOrThrow({ where: { id: userB } }),
    ).resolves.toMatchObject({ displayName: 'Owner' });
    await expect(
      h.prisma.workspace.findUniqueOrThrow({ where: { id: workspaceB } }),
    ).resolves.toMatchObject({
      organizationId: organizationB,
      name: 'Main Workspace',
    });
    await expect(
      h.prisma.membership.findUniqueOrThrow({ where: { id: membershipB.id } }),
    ).resolves.toMatchObject({ role: 'OWNER', removedAt: null });
    await expect(
      h.prisma.membership.findUniqueOrThrow({
        where: { id: membershipBMemberId },
      }),
    ).resolves.toMatchObject({ role: 'MEMBER', removedAt: null });
    await expect(
      h.prisma.membershipInvitation.findUniqueOrThrow({
        where: { id: invitationBId },
      }),
    ).resolves.toMatchObject({
      activeKey: invitationBActiveKey,
      revokedAt: null,
    });
    expect(
      await h.prisma.membershipInvitation.count({
        where: {
          workspaceId: workspaceA,
          normalizedEmail: 'tenant-matrix-http-target@example.com',
        },
      }),
    ).toBe(1);
    expect(
      await h.prisma.auditLog.count({
        where: { workspaceId: workspaceB, actorUserId: userA },
      }),
    ).toBe(0);
    expect(
      await h.prisma.auditLog.count({
        where: {
          resourceId: { in: [membershipBMemberId, invitationBId] },
          action: {
            in: [
              'membership.role.updated',
              'membership.removed',
              'membership.ownership.transferred',
              'membership.invitation.revoked',
            ],
          },
        },
      }),
    ).toBe(0);
  });

  it('enforces the tenant-isolation matrix for workspace-scoped repositories', async () => {
    const tenantA = await h.register('tenant-matrix-repository-a@example.com');
    const tenantB = await h.register('tenant-matrix-repository-b@example.com');
    const foreignMember = await h.register(
      'tenant-matrix-repository-member@example.com',
    );
    const userA = h.readString(tenantA.body as unknown, 'data', 'user', 'id');
    const userB = h.readString(tenantB.body as unknown, 'data', 'user', 'id');
    const foreignMemberUserId = h.readString(
      foreignMember.body as unknown,
      'data',
      'user',
      'id',
    );
    const workspaceA = h.readString(
      tenantA.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const workspaceB = h.readString(
      tenantB.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const organizationA = h.readString(
      tenantA.body as unknown,
      'data',
      'organization',
      'id',
    );
    const organizationB = h.readString(
      tenantB.body as unknown,
      'data',
      'organization',
      'id',
    );
    const ownerA = await h.prisma.membership.findUniqueOrThrow({
      where: { workspaceId_userId: { workspaceId: workspaceA, userId: userA } },
    });
    const ownerB = await h.prisma.membership.findUniqueOrThrow({
      where: { workspaceId_userId: { workspaceId: workspaceB, userId: userB } },
    });
    const localTargetId = h.randomUUID();
    await h.prisma.membership.create({
      data: {
        id: localTargetId,
        workspaceId: workspaceA,
        userId: userB,
        role: 'MEMBER',
      },
    });
    const foreignMemberId = h.randomUUID();
    await h.prisma.membership.create({
      data: {
        id: foreignMemberId,
        workspaceId: workspaceB,
        userId: foreignMemberUserId,
        role: 'MEMBER',
      },
    });
    const foreignSessionResponse = await h.login(
      'tenant-matrix-repository-member@example.com',
      'A secure passphrase 123',
      workspaceB,
    );
    expect(foreignSessionResponse.status).toBe(201);
    const foreignSessionToken = h
      .readCookieHeader(foreignSessionResponse)
      .split('=', 2)[1];
    const foreignSession = await h.prisma.session.findUniqueOrThrow({
      where: {
        tokenHash: new h.SessionTokenService().hash(foreignSessionToken),
      },
    });
    const invitationBId = h.randomUUID();
    const invitationBTokenHash = 'd'.repeat(64);
    const invitationBActiveKey = 'e'.repeat(64);
    const invitationEmail = 'tenant-matrix-repository-target@example.com';
    await h.prisma.membershipInvitation.create({
      data: {
        id: invitationBId,
        workspaceId: workspaceB,
        invitedByUserId: userB,
        normalizedEmail: invitationEmail,
        role: 'MEMBER',
        tokenHash: invitationBTokenHash,
        activeKey: invitationBActiveKey,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const membershipsRepository = h.app.get(h.PrismaMembershipsRepository);
    const invitationsRepository = h.app.get(
      h.PrismaMembershipInvitationsRepository,
    );
    const sessionsRepository = h.app.get(
      h.PrismaAuthenticationSessionsRepository,
    );
    const workspacesRepository = h.app.get(h.PrismaWorkspacesRepository);
    const now = new Date();

    await expect(
      membershipsRepository.find({
        workspaceId: workspaceA,
        userId: foreignMemberUserId,
      }),
    ).resolves.toBeNull();
    await expect(
      membershipsRepository.findActiveById(workspaceA, foreignMemberId),
    ).resolves.toBeNull();
    await expect(
      membershipsRepository.findActiveForUser(workspaceA, foreignMemberUserId),
    ).resolves.toBeNull();
    await expect(
      membershipsRepository.listActive({
        workspaceId: workspaceA,
        cursor: foreignMemberId,
        limit: 50,
      }),
    ).resolves.toBeNull();
    const visibleMemberships = await membershipsRepository.listActive({
      workspaceId: workspaceA,
      limit: 50,
    });
    expect(visibleMemberships?.map(({ id }) => id)).toEqual(
      expect.arrayContaining([ownerA.id, localTargetId]),
    );
    expect(visibleMemberships).toHaveLength(2);
    await expect(
      membershipsRepository.updateRole({
        workspaceId: workspaceA,
        membershipId: foreignMemberId,
        expectedRole: 'MEMBER',
        role: 'ADMIN',
      }),
    ).resolves.toBe(false);
    await expect(
      membershipsRepository.remove({
        workspaceId: workspaceA,
        membershipId: foreignMemberId,
        expectedRole: 'MEMBER',
        removedAt: now,
      }),
    ).resolves.toBe(false);
    await expect(
      membershipsRepository.transferOwnership({
        workspaceId: workspaceA,
        currentOwnerMembershipId: ownerA.id,
        targetMembershipId: foreignMemberId,
        expectedTargetRole: 'MEMBER',
      }),
    ).resolves.toBe(false);
    await expect(
      membershipsRepository.transferOwnership({
        workspaceId: workspaceA,
        currentOwnerMembershipId: ownerB.id,
        targetMembershipId: localTargetId,
        expectedTargetRole: 'MEMBER',
      }),
    ).resolves.toBe(false);
    await expect(
      membershipsRepository.countActiveOwners(workspaceA),
    ).resolves.toBe(1);

    await expect(
      invitationsRepository.findActiveById(workspaceA, invitationBId, now),
    ).resolves.toBeNull();
    await expect(
      invitationsRepository.findActiveForEmail(
        workspaceA,
        invitationEmail,
        now,
      ),
    ).resolves.toBeNull();
    await invitationsRepository.retireActive(workspaceA, invitationEmail, now);
    await expect(
      invitationsRepository.revoke(workspaceA, invitationBId, now),
    ).resolves.toBe(false);
    await expect(
      invitationsRepository.accept(workspaceA, invitationBId, userA, now),
    ).resolves.toBe(false);
    await invitationsRepository.markDelivery(
      workspaceA,
      invitationBId,
      'FAILED',
      now,
    );
    await expect(
      invitationsRepository.findUsableByTokenHash(invitationBTokenHash, now),
    ).resolves.toMatchObject({
      id: invitationBId,
      workspaceId: workspaceB,
    });

    await expect(
      sessionsRepository.hasActiveContext({
        sessionId: foreignSession.id,
        userId: foreignMemberUserId,
        workspaceId: workspaceA,
        now,
      }),
    ).resolves.toBe(false);
    await expect(
      sessionsRepository.revokeActiveForMembership({
        userId: foreignMemberUserId,
        workspaceId: workspaceA,
        revokedAt: now,
      }),
    ).resolves.toEqual([]);
    await expect(
      workspacesRepository.rename({
        id: workspaceB,
        organizationId: organizationA,
        expectedName: 'Main Workspace',
        name: 'Cross-tenant Rename',
      }),
    ).resolves.toBe(false);

    await expect(
      h.prisma.membership.findUniqueOrThrow({ where: { id: foreignMemberId } }),
    ).resolves.toMatchObject({ role: 'MEMBER', removedAt: null });
    await expect(
      h.prisma.membership.findUniqueOrThrow({ where: { id: ownerB.id } }),
    ).resolves.toMatchObject({ role: 'OWNER', removedAt: null });
    await expect(
      h.prisma.membership.findUniqueOrThrow({ where: { id: localTargetId } }),
    ).resolves.toMatchObject({ role: 'MEMBER', removedAt: null });
    await expect(
      h.prisma.membershipInvitation.findUniqueOrThrow({
        where: { id: invitationBId },
      }),
    ).resolves.toMatchObject({
      activeKey: invitationBActiveKey,
      acceptedAt: null,
      revokedAt: null,
      deliveryStatus: 'PENDING',
    });
    await expect(
      h.prisma.session.findUniqueOrThrow({ where: { id: foreignSession.id } }),
    ).resolves.toMatchObject({
      revokedAt: null,
      activeWorkspaceId: workspaceB,
    });
    await expect(
      h.prisma.workspace.findUniqueOrThrow({ where: { id: workspaceB } }),
    ).resolves.toMatchObject({
      organizationId: organizationB,
      name: 'Main Workspace',
    });
  });

  it('rolls back every durable record when a module participant fails', async () => {
    jest
      .spyOn(h.auditLog, 'append')
      .mockRejectedValueOnce(new Error('audit unavailable'));

    const response = await h.register('rollback@example.com');
    expect(response.status).toBe(503);
    expect(h.readString(response.body as unknown, 'error', 'code')).toBe(
      'REGISTRATION_UNAVAILABLE',
    );
    expect(await h.prisma.identity.count()).toBe(0);
    expect(await h.prisma.user.count()).toBe(0);
    expect(await h.prisma.organization.count()).toBe(0);
    expect(await h.prisma.workspace.count()).toBe(0);
    expect(await h.prisma.membership.count()).toBe(0);
    expect(await h.prisma.session.count()).toBe(0);
  });

  it('keeps a committed registration usable when the Redis session cache misses', async () => {
    jest
      .spyOn(h.sessionCache, 'store')
      .mockRejectedValueOnce(new Error('redis cache unavailable'));

    const response = await h.register('cache-miss@example.com');
    expect(response.status).toBe(201);
    expect(await h.prisma.identity.count()).toBe(1);
    expect(await h.prisma.session.count()).toBe(1);

    const cookie = (
      response.headers['set-cookie'] as unknown as string[]
    )[0].split(';', 1)[0];
    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', cookie)
      .expect(200);
  });

  it('resolves an authoritative PostgreSQL session during a Redis cache outage', async () => {
    const response = await h.register('session-cache-outage@example.com');
    const cookie = (
      response.headers['set-cookie'] as unknown as string[]
    )[0].split(';', 1)[0];
    jest
      .spyOn(h.sessionCache, 'exists')
      .mockRejectedValueOnce(new Error('redis cache unavailable'));

    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', cookie)
      .expect(200);
  });

  it('keeps current-session authentication failures private and non-cacheable', async () => {
    const missing = await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session');
    expect(missing.status).toBe(401);
    expect(missing.headers['cache-control']).toBe('no-store');
    expect(missing.headers.pragma).toBe('no-cache');

    const registration = await h.register(
      'session-database-outage@example.com',
    );
    const cookie = h.readCookieHeader(registration);
    jest
      .spyOn(h.prisma.session, 'findUnique')
      .mockRejectedValueOnce(new Error('database unavailable'));

    const unavailable = await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', cookie);
    expect(unavailable.status).toBe(503);
    expect(h.readString(unavailable.body as unknown, 'error', 'code')).toBe(
      'AUTHENTICATION_UNAVAILABLE',
    );
    expect(unavailable.headers['cache-control']).toBe('no-store');
    expect(unavailable.headers.pragma).toBe('no-cache');
  });

  it('replaces an attacker-supplied session cookie during registration', async () => {
    const response = await h
      .request(h.app.getHttpServer())
      .post('/v1/auth/registrations')
      .set('Origin', h.allowedOrigin)
      .set('Cookie', '__Host-nexora_session=attacker-controlled')
      .send(h.registrationBody('rotation@example.com'));

    expect(response.status).toBe(201);
    const setCookie = response.headers['set-cookie'] as unknown as string[];
    expect(setCookie[0]).not.toContain('attacker-controlled');
  });
});
