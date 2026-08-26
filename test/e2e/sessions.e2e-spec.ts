import { createE2eHarness, type E2eHarness } from './e2e-harness';

describe('Nexora API - Sessions (e2e)', () => {
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

  it('authenticates a returning user with a fresh server-generated session', async () => {
    const registration = await h.register('returning@example.com');
    const registrationCookie = h.readCookieHeader(registration);

    const authenticated = await h
      .request(h.app.getHttpServer())
      .post('/v1/auth/sessions')
      .set('Origin', h.allowedOrigin)
      .set('Cookie', '__Host-nexora_session=attacker-controlled')
      .send(h.loginBody(' RETURNING@Example.com '));

    expect(authenticated.status).toBe(201);
    expect(authenticated.headers['cache-control']).toBe('no-store');
    expect(authenticated.body).toMatchObject({
      data: {
        user: { displayName: 'Owner' },
        organization: { name: 'Nexora Customer' },
        workspace: { name: 'Main Workspace' },
        membership: { role: 'OWNER' },
      },
      meta: {},
    });
    const authenticatedCookie = h.readCookieHeader(authenticated);
    expect(authenticatedCookie).not.toBe(registrationCookie);
    expect(authenticatedCookie).not.toContain('attacker-controlled');
    expect(h.readSetCookie(authenticated)).toContain('HttpOnly');
    expect(h.readSetCookie(authenticated)).toContain('Secure');
    expect(h.readSetCookie(authenticated)).toContain('SameSite=Lax');
    expect(h.readSetCookie(authenticated)).toContain('Path=/');
    expect(h.readSetCookie(authenticated)).not.toContain('Domain=');
    expect(await h.prisma.session.count()).toBe(2);
    expect(
      await h.prisma.auditLog.count({
        where: { action: 'auth.session.created' },
      }),
    ).toBe(1);

    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', authenticatedCookie)
      .expect(200);
  });

  it('uses one generic failure for unknown and incorrect credentials', async () => {
    await h.register('known@example.com');
    const sessionCount = await h.prisma.session.count();

    const wrong = await h.login('known@example.com', 'A wrong passphrase 123');
    const missing = await h.login(
      'missing@example.com',
      'A wrong passphrase 123',
    );

    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    for (const response of [wrong, missing]) {
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toMatchObject({
        error: {
          code: 'AUTHENTICATION_INVALID',
          message: 'Email or password is incorrect.',
          retryable: false,
        },
      });
    }
    expect(await h.prisma.session.count()).toBe(sessionCount);
    expect(
      await h.prisma.auditLog.count({
        where: { action: 'auth.session.created' },
      }),
    ).toBe(0);
  });

  it('rolls back session creation when its audit record cannot be written', async () => {
    await h.register('login-rollback@example.com');
    const sessionCount = await h.prisma.session.count();
    jest
      .spyOn(h.auditLog, 'append')
      .mockRejectedValueOnce(new Error('audit unavailable'));

    const response = await h.login('login-rollback@example.com');
    expect(response.status).toBe(503);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(await h.prisma.session.count()).toBe(sessionCount);
    expect(
      await h.prisma.auditLog.count({
        where: { action: 'auth.session.created' },
      }),
    ).toBe(0);
  });

  it('requires an explicit authorized workspace for multi-workspace login', async () => {
    const registration = await h.register('workspace-choice@example.com');
    const userId = h.readString(
      registration.body as unknown,
      'data',
      'user',
      'id',
    );
    const initialWorkspaceId = h.readString(
      registration.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const second = await h.createWorkspaceMembership(
      h.prisma,
      userId,
      'Second Org',
      'Second Workspace',
    );

    const injected = await h
      .request(h.app.getHttpServer())
      .post('/v1/auth/sessions')
      .set('Origin', h.allowedOrigin)
      .send({
        ...h.loginBody('workspace-choice@example.com'),
        workspaceId: second.workspaceId,
        role: 'OWNER',
      });
    expect(injected.status).toBe(400);

    const crossOrigin = await h
      .request(h.app.getHttpServer())
      .post('/v1/auth/sessions')
      .set('Origin', 'https://attacker.example')
      .send(h.loginBody('workspace-choice@example.com'));
    expect(crossOrigin.status).toBe(403);

    const ambiguous = await h.login('workspace-choice@example.com');
    expect(ambiguous.status).toBe(409);
    expect(h.readString(ambiguous.body as unknown, 'error', 'code')).toBe(
      'WORKSPACE_SELECTION_REQUIRED',
    );
    expect(ambiguous.headers['set-cookie']).toBeUndefined();
    expect(ambiguous.body).toMatchObject({
      error: {
        details: {
          availableWorkspaces: [
            { workspace: { id: initialWorkspaceId } },
            { workspace: { id: second.workspaceId } },
          ],
        },
      },
    });
    expect(await h.prisma.session.count()).toBe(1);

    const inaccessible = await h.login(
      'workspace-choice@example.com',
      'A secure passphrase 123',
      h.randomUUID(),
    );
    expect(inaccessible.status).toBe(401);
    expect(h.readString(inaccessible.body as unknown, 'error', 'code')).toBe(
      'AUTHENTICATION_INVALID',
    );
    expect(inaccessible.headers['set-cookie']).toBeUndefined();

    const selected = await h.login(
      'workspace-choice@example.com',
      'A secure passphrase 123',
      second.workspaceId,
    );
    expect(selected.status).toBe(201);
    expect(
      h.readString(selected.body as unknown, 'data', 'workspace', 'id'),
    ).toBe(second.workspaceId);
    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', h.readCookieHeader(selected))
      .expect(200)
      .expect(({ body }) => {
        expect(h.readString(body as unknown, 'data', 'workspace', 'id')).toBe(
          second.workspaceId,
        );
      });
  });

  it('lists only the actor workspaces and rotates one session when switching', async () => {
    const registration = await h.register('workspace-switch@example.com');
    const userId = h.readString(
      registration.body as unknown,
      'data',
      'user',
      'id',
    );
    const initialWorkspaceId = h.readString(
      registration.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const second = await h.createWorkspaceMembership(
      h.prisma,
      userId,
      'Second Org',
      'Second Workspace',
    );
    const selectedLogin = await h.login(
      'workspace-switch@example.com',
      'A secure passphrase 123',
      second.workspaceId,
    );
    const selectedCookie = h.readCookieHeader(selectedLogin);
    const selectedTokenHash = new h.OpaqueTokenService().hash(
      selectedCookie.slice(selectedCookie.indexOf('=') + 1),
    );
    const selectedSession = await h.prisma.session.findUniqueOrThrow({
      where: { tokenHash: selectedTokenHash },
    });

    const otherAccount = await h.register('workspace-switch-other@example.com');
    const otherWorkspaceId = h.readString(
      otherAccount.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const listed = await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session/workspaces')
      .set('Cookie', selectedCookie)
      .set('X-Workspace-Id', otherWorkspaceId)
      .expect(200);
    const listedIds = h
      .readArray(listed.body as unknown, 'data')
      .map((value) => h.readString(value, 'workspace', 'id'));
    expect(listedIds).toEqual([initialWorkspaceId, second.workspaceId]);
    expect(listedIds).not.toContain(otherWorkspaceId);
    expect(
      h.readString(listed.body as unknown, 'meta', 'activeWorkspaceId'),
    ).toBe(second.workspaceId);

    const sessionCount = await h.prisma.session.count();
    const auditCount = await h.prisma.auditLog.count();
    const crossOrigin = await h
      .request(h.app.getHttpServer())
      .put('/v1/auth/session/workspace')
      .set('Origin', 'https://attacker.example')
      .set('Cookie', selectedCookie)
      .send({ workspaceId: initialWorkspaceId });
    expect(crossOrigin.status).toBe(403);
    const injected = await h
      .request(h.app.getHttpServer())
      .put('/v1/auth/session/workspace')
      .set('Origin', h.allowedOrigin)
      .set('Cookie', selectedCookie)
      .send({ workspaceId: initialWorkspaceId, role: 'OWNER' });
    expect(injected.status).toBe(400);
    expect(await h.prisma.session.count()).toBe(sessionCount);
    expect(await h.prisma.auditLog.count()).toBe(auditCount);

    const denied = await h.switchWorkspace(selectedCookie, otherWorkspaceId);
    expect(denied.status).toBe(403);
    expect(h.readString(denied.body as unknown, 'error', 'code')).toBe(
      'WORKSPACE_ACCESS_DENIED',
    );
    expect(await h.prisma.session.count()).toBe(sessionCount);
    expect(await h.prisma.auditLog.count()).toBe(auditCount);

    const unchanged = await h.switchWorkspace(
      selectedCookie,
      second.workspaceId,
    );
    expect(unchanged.status).toBe(200);
    expect(h.readCookieHeader(unchanged)).toBe(selectedCookie);
    expect(unchanged.body).toMatchObject({ meta: { sessionRotated: false } });
    expect(await h.prisma.auditLog.count()).toBe(auditCount);

    const switched = await h.switchWorkspace(
      selectedCookie,
      initialWorkspaceId,
    );
    expect(switched.status).toBe(200);
    expect(switched.body).toMatchObject({
      data: { workspace: { id: initialWorkspaceId } },
      meta: { sessionRotated: true },
    });
    const switchedCookie = h.readCookieHeader(switched);
    expect(switchedCookie).not.toBe(selectedCookie);
    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', selectedCookie)
      .expect(401);
    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', switchedCookie)
      .expect(200)
      .expect(({ body }) => {
        expect(h.readString(body as unknown, 'data', 'workspace', 'id')).toBe(
          initialWorkspaceId,
        );
      });

    const replacementHash = new h.OpaqueTokenService().hash(
      switchedCookie.slice(switchedCookie.indexOf('=') + 1),
    );
    const replacement = await h.prisma.session.findUniqueOrThrow({
      where: { tokenHash: replacementHash },
    });
    expect(replacement.expiresAt).toEqual(selectedSession.expiresAt);
    expect(replacement.activeWorkspaceId).toBe(initialWorkspaceId);
    expect(
      await h.prisma.auditLog.findMany({
        where: { action: 'auth.workspace.switched', actorUserId: userId },
        orderBy: { workspaceId: 'asc' },
        select: { workspaceId: true },
      }),
    ).toEqual(
      [initialWorkspaceId, second.workspaceId]
        .sort()
        .map((workspaceId) => ({ workspaceId })),
    );
  });

  it('does not allow pending users to list or switch workspaces', async () => {
    const registration = await h.registerUnverified(
      'workspace-switch-pending@example.com',
    );
    const cookie = h.readCookieHeader(registration);
    const workspaceId = h.readString(
      registration.body as unknown,
      'data',
      'workspace',
      'id',
    );

    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session/workspaces')
      .set('Cookie', cookie)
      .expect(403);
    await h.switchWorkspace(cookie, workspaceId).expect(403);
  });

  it('rolls back switching on audit failure and fails closed on limiter failure', async () => {
    const registration = await h.register(
      'workspace-switch-failure@example.com',
    );
    const userId = h.readString(
      registration.body as unknown,
      'data',
      'user',
      'id',
    );
    const initialWorkspaceId = h.readString(
      registration.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const second = await h.createWorkspaceMembership(
      h.prisma,
      userId,
      'Second Org',
      'Second Workspace',
    );
    const selected = await h.login(
      'workspace-switch-failure@example.com',
      'A secure passphrase 123',
      second.workspaceId,
    );
    const cookie = h.readCookieHeader(selected);
    const sessionCount = await h.prisma.session.count();
    const auditCount = await h.prisma.auditLog.count();

    jest
      .spyOn(h.auditLog, 'append')
      .mockRejectedValueOnce(new Error('audit unavailable'));
    const failed = await h.switchWorkspace(cookie, initialWorkspaceId);
    expect(failed.status).toBe(503);
    expect(failed.headers['set-cookie']).toBeUndefined();
    expect(await h.prisma.session.count()).toBe(sessionCount);
    expect(await h.prisma.auditLog.count()).toBe(auditCount);
    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', cookie)
      .expect(200);

    jest.restoreAllMocks();
    jest
      .spyOn(h.authenticationRateLimiter, 'checkWorkspaceSwitch')
      .mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 30 });
    const limited = await h.switchWorkspace(cookie, initialWorkspaceId);
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBe('30');
    expect(await h.prisma.session.count()).toBe(sessionCount);
    expect(await h.prisma.auditLog.count()).toBe(auditCount);

    jest
      .spyOn(h.authenticationRateLimiter, 'checkWorkspaceSwitch')
      .mockRejectedValueOnce(new Error('redis unavailable'));
    const unavailable = await h.switchWorkspace(cookie, initialWorkspaceId);
    expect(unavailable.status).toBe(503);
    expect(await h.prisma.session.count()).toBe(sessionCount);
    expect(await h.prisma.auditLog.count()).toBe(auditCount);
  });

  it('allows only one concurrent switch for the same presented session', async () => {
    const registration = await h.register('workspace-switch-race@example.com');
    const userId = h.readString(
      registration.body as unknown,
      'data',
      'user',
      'id',
    );
    const initialWorkspaceId = h.readString(
      registration.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const second = await h.createWorkspaceMembership(
      h.prisma,
      userId,
      'Second Org',
      'Second Workspace',
    );
    const selected = await h.login(
      'workspace-switch-race@example.com',
      'A secure passphrase 123',
      second.workspaceId,
    );
    const cookie = h.readCookieHeader(selected);

    const responses = await Promise.all([
      h.switchWorkspace(cookie, initialWorkspaceId),
      h.switchWorkspace(cookie, initialWorkspaceId),
    ]);

    expect(responses.map(({ status }) => status).sort()).toEqual([200, 401]);
    expect(
      await h.prisma.session.count({ where: { userId, revokedAt: null } }),
    ).toBe(2);
    expect(
      await h.prisma.auditLog.count({
        where: { action: 'auth.workspace.switched', actorUserId: userId },
      }),
    ).toBe(2);
  });

  it('rate-limits login before credential verification and fails safely when enforcement is unavailable', async () => {
    const authenticate = jest
      .spyOn(h.passwordIdentities, 'authenticate')
      .mockResolvedValue(null);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await h
        .request(h.app.getHttpServer())
        .post('/v1/auth/sessions')
        .set('Origin', h.allowedOrigin)
        .set('X-Forwarded-For', '203.0.113.20')
        .send(h.loginBody('limited-login@example.com'));
      expect(response.status).toBe(401);
    }

    const limited = await h
      .request(h.app.getHttpServer())
      .post('/v1/auth/sessions')
      .set('Origin', h.allowedOrigin)
      .set('X-Forwarded-For', '203.0.113.20')
      .send(h.loginBody('limited-login@example.com'));
    expect(limited.status).toBe(429);
    expect(h.readString(limited.body as unknown, 'error', 'code')).toBe(
      'AUTHENTICATION_RATE_LIMITED',
    );
    expect(limited.headers['retry-after']).toBeDefined();
    expect(authenticate).toHaveBeenCalledTimes(10);

    await h.redis.client.flushDb();
    authenticate.mockClear();
    jest
      .spyOn(h.authenticationRateLimiter, 'checkLogin')
      .mockRejectedValueOnce(new Error('redis unavailable'));
    const unavailable = await h.login('unavailable@example.com');
    expect(unavailable.status).toBe(503);
    expect(h.readString(unavailable.body as unknown, 'error', 'code')).toBe(
      'AUTHENTICATION_UNAVAILABLE',
    );
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('revokes only the current session, tolerates cache failure, and remains idempotent', async () => {
    const registration = await h.register('logout@example.com');
    const registrationCookie = h.readCookieHeader(registration);
    const authenticated = await h.login('logout@example.com');
    const authenticatedCookie = h.readCookieHeader(authenticated);
    jest
      .spyOn(h.sessionCache, 'remove')
      .mockRejectedValueOnce(new Error('redis cache unavailable'));

    const [logout, concurrentLogout] = await Promise.all([
      h
        .request(h.app.getHttpServer())
        .delete('/v1/auth/session')
        .set('Origin', h.allowedOrigin)
        .set('Cookie', authenticatedCookie),
      h
        .request(h.app.getHttpServer())
        .delete('/v1/auth/session')
        .set('Origin', h.allowedOrigin)
        .set('Cookie', authenticatedCookie),
    ]);
    expect([logout.status, concurrentLogout.status]).toEqual([204, 204]);
    expect(h.readSetCookie(logout)).toContain('__Host-nexora_session=;');
    expect(h.readSetCookie(logout)).toContain('Expires=');
    expect(h.readSetCookie(logout)).toContain('Max-Age=0');
    expect(await h.prisma.session.count({ where: { revokedAt: null } })).toBe(
      1,
    );
    expect(
      await h.prisma.auditLog.count({
        where: { action: 'auth.session.revoked' },
      }),
    ).toBe(1);

    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', authenticatedCookie)
      .expect(401);
    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', registrationCookie)
      .expect(200);
    await h
      .request(h.app.getHttpServer())
      .delete('/v1/auth/session')
      .set('Origin', h.allowedOrigin)
      .set('Cookie', authenticatedCookie)
      .expect(204);
    const anonymousLogout = await h
      .request(h.app.getHttpServer())
      .delete('/v1/auth/session')
      .set('Origin', h.allowedOrigin)
      .expect(204);
    expect(h.readSetCookie(anonymousLogout)).toContain(
      '__Host-nexora_session=;',
    );
    expect(
      await h.prisma.auditLog.count({
        where: { action: 'auth.session.revoked' },
      }),
    ).toBe(1);
  });

  it('rolls back revocation when its audit record cannot be written', async () => {
    const registration = await h.register('logout-rollback@example.com');
    const cookie = h.readCookieHeader(registration);
    jest
      .spyOn(h.auditLog, 'append')
      .mockRejectedValueOnce(new Error('audit unavailable'));

    const response = await h
      .request(h.app.getHttpServer())
      .delete('/v1/auth/session')
      .set('Origin', h.allowedOrigin)
      .set('Cookie', cookie);
    expect(response.status).toBe(503);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(await h.prisma.session.count({ where: { revokedAt: null } })).toBe(
      1,
    );
  });

  it('revokes every session for the current user without affecting another tenant', async () => {
    const accountA = await h.register('revoke-all-a@example.com');
    const loginA = await h.login('revoke-all-a@example.com');
    const userA = h.readString(accountA.body as unknown, 'data', 'user', 'id');
    const accountB = await h.register('revoke-all-b@example.com');
    const loginB = await h.login('revoke-all-b@example.com');
    const userB = h.readString(accountB.body as unknown, 'data', 'user', 'id');

    await h
      .request(h.app.getHttpServer())
      .delete('/v1/auth/sessions')
      .set('Origin', h.allowedOrigin)
      .set('Cookie', h.readCookieHeader(loginA))
      .expect(204);

    expect(
      await h.prisma.session.count({
        where: { userId: userA, revokedAt: null },
      }),
    ).toBe(0);
    expect(
      await h.prisma.session.count({
        where: { userId: userB, revokedAt: null },
      }),
    ).toBe(2);
    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', h.readCookieHeader(accountA))
      .expect(401);
    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', h.readCookieHeader(loginB))
      .expect(200);
    expect(
      await h.prisma.auditLog.count({
        where: { action: 'auth.sessions.revoked_all', actorUserId: userA },
      }),
    ).toBe(1);
  });

  it('allows a pending user to revoke every session without full tenant admission', async () => {
    const registration = await h.registerUnverified(
      'revoke-all-pending@example.com',
    );
    const userId = h.readString(
      registration.body as unknown,
      'data',
      'user',
      'id',
    );

    await h
      .request(h.app.getHttpServer())
      .delete('/v1/auth/sessions')
      .set('Origin', h.allowedOrigin)
      .set('Cookie', h.readCookieHeader(registration))
      .expect(204);

    expect(
      await h.prisma.session.count({ where: { userId, revokedAt: null } }),
    ).toBe(0);
  });

  it('does not allow one session to resolve another workspace', async () => {
    const accountA = await h.register('tenant-a@example.com');
    const cookieA = (
      accountA.headers['set-cookie'] as unknown as string[]
    )[0].split(';', 1)[0];
    const workspaceA = h.readString(
      accountA.body as unknown,
      'data',
      'workspace',
      'id',
    );

    const accountB = await h.register('tenant-b@example.com');
    const workspaceB = h.readString(
      accountB.body as unknown,
      'data',
      'workspace',
      'id',
    );

    const current = await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', cookieA)
      .set('X-User-Id', h.randomUUID())
      .set('X-Workspace-Id', workspaceB)
      .set('X-Membership-Role', 'OWNER')
      .expect(200);
    expect(
      h.readString(current.body as unknown, 'data', 'workspace', 'id'),
    ).toBe(workspaceA);
    expect(
      h.readString(current.body as unknown, 'data', 'workspace', 'id'),
    ).not.toBe(workspaceB);
  });

  it('enforces the session-to-membership tenant invariant in PostgreSQL', async () => {
    const accountA = await h.register('constraint-a@example.com');
    const accountB = await h.register('constraint-b@example.com');
    const userA = h.readString(accountA.body as unknown, 'data', 'user', 'id');
    const workspaceB = h.readString(
      accountB.body as unknown,
      'data',
      'workspace',
      'id',
    );

    await expect(
      h.prisma.session.create({
        data: {
          id: h.randomUUID(),
          tokenHash: 'a'.repeat(64),
          userId: userA,
          activeWorkspaceId: workspaceB,
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
    ).rejects.toBeDefined();
  });
});
