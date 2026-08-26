import { createE2eHarness, type E2eHarness } from './e2e-harness';

describe('Nexora API - Passwords (e2e)', () => {
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

  it('resets a password, revokes every session, and accepts only the replacement password', async () => {
    const registration = await h.register('password-reset@example.com');
    const registrationCookie = h.readCookieHeader(registration);
    const secondSession = await h.login('password-reset@example.com');
    const secondCookie = h.readCookieHeader(secondSession);

    const missing = await h.requestPasswordReset('missing@example.com');
    const existing = await h.requestPasswordReset(
      ' PASSWORD-RESET@Example.com ',
    );
    expect(missing.status).toBe(202);
    expect(existing.status).toBe(202);
    expect(existing.body).toEqual(missing.body);

    const token = h.readPasswordResetToken('password-reset@example.com');
    const stored = await h.prisma.passwordResetToken.findFirstOrThrow();
    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.tokenHash).not.toBe(token);

    const reset = await h.confirmPasswordReset(
      token,
      'A replacement passphrase 456',
    );
    expect(reset.status).toBe(204);
    expect(h.readSetCookie(reset)).toContain('__Host-nexora_session=;');
    expect(
      (await h.prisma.passwordResetToken.findFirstOrThrow()).consumedAt,
    ).not.toBeNull();
    expect(await h.prisma.session.count({ where: { revokedAt: null } })).toBe(
      0,
    );
    expect(
      await h.prisma.auditLog.count({
        where: { action: 'password.reset.completed' },
      }),
    ).toBe(1);

    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', registrationCookie)
      .expect(401);
    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', secondCookie)
      .expect(401);
    expect((await h.login('password-reset@example.com')).status).toBe(401);
    expect(
      (
        await h.login(
          'password-reset@example.com',
          'A replacement passphrase 456',
        )
      ).status,
    ).toBe(201);
  });

  it('replaces reset links and allows only one concurrent confirmation', async () => {
    await h.register('reset-replacement@example.com');
    await h.requestPasswordReset('reset-replacement@example.com');
    const firstToken = h.readPasswordResetToken(
      'reset-replacement@example.com',
    );
    await h.requestPasswordReset('reset-replacement@example.com');
    const secondToken = h.readPasswordResetToken(
      'reset-replacement@example.com',
      firstToken,
    );

    await h
      .confirmPasswordReset(firstToken, 'A replacement passphrase 456')
      .expect(400);
    const results = await Promise.all([
      h.confirmPasswordReset(secondToken, 'A concurrent passphrase 456'),
      h.confirmPasswordReset(secondToken, 'A concurrent passphrase 456'),
    ]);
    expect(results.map((response) => response.status).sort()).toEqual([
      204, 400,
    ]);
    expect(
      await h.prisma.passwordResetToken.count({
        where: { invalidatedAt: { not: null } },
      }),
    ).toBe(1);
  });

  it('rejects expired and compromised reset attempts without changing the password', async () => {
    await h.register('reset-invalid@example.com');
    await h.requestPasswordReset('reset-invalid@example.com');
    const compromisedToken = h.readPasswordResetToken(
      'reset-invalid@example.com',
    );

    const compromised = await h.confirmPasswordReset(
      compromisedToken,
      '123456789012345',
    );
    expect(compromised.status).toBe(400);
    expect(h.readString(compromised.body as unknown, 'error', 'code')).toBe(
      'PASSWORD_RESET_INVALID_PASSWORD',
    );
    expect(
      (await h.prisma.passwordResetToken.findFirstOrThrow()).consumedAt,
    ).toBeNull();

    await h.requestPasswordReset('reset-invalid@example.com');
    const expiredToken = h.readPasswordResetToken(
      'reset-invalid@example.com',
      compromisedToken,
    );
    const latestReset = await h.prisma.passwordResetToken.findFirstOrThrow({
      orderBy: { createdAt: 'desc' },
    });
    await h.prisma.passwordResetToken.update({
      where: { id: latestReset.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    await h
      .confirmPasswordReset(expiredToken, 'A replacement passphrase 456')
      .expect(400);
    expect((await h.login('reset-invalid@example.com')).status).toBe(201);
  });

  it('keeps reset requests generic when delivery fails', async () => {
    await h.register('reset-delivery@example.com');
    jest
      .spyOn(h.recordingPasswordResetSender, 'send')
      .mockRejectedValueOnce(new Error('mail provider unavailable'));

    const response = await h.requestPasswordReset('reset-delivery@example.com');

    expect(response.status).toBe(202);
    expect(
      (await h.prisma.passwordResetToken.findFirstOrThrow()).deliveryStatus,
    ).toBe('FAILED');
  });

  it('anchors password reset to the latest active membership after tenant removal', async () => {
    const tenantA = await h.register('reset-scope-owner@example.com');
    const tenantACookie = h.readCookieHeader(tenantA);
    const workspaceA = h.readString(
      tenantA.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const target = await h.register('reset-scope-target@example.com');
    const targetHomeCookie = h.readCookieHeader(target);
    const targetUserId = h.readString(
      target.body as unknown,
      'data',
      'user',
      'id',
    );
    const targetHomeWorkspaceId = h.readString(
      target.body as unknown,
      'data',
      'workspace',
      'id',
    );
    await h
      .createInvitation(
        tenantACookie,
        'reset-scope-target@example.com',
        'MEMBER',
      )
      .expect(201);
    await h
      .acceptInvitation(
        targetHomeCookie,
        h.readInvitationToken('reset-scope-target@example.com'),
      )
      .expect(204);
    const selectedTenantA = await h.login(
      'reset-scope-target@example.com',
      'A secure passphrase 123',
      workspaceA,
    );
    expect(selectedTenantA.status).toBe(201);
    const tenantAMembership = await h.prisma.membership.findUniqueOrThrow({
      where: {
        workspaceId_userId: { workspaceId: workspaceA, userId: targetUserId },
      },
    });

    await h
      .removeWorkspaceMembership(tenantACookie, tenantAMembership.id)
      .expect(204);
    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', h.readCookieHeader(selectedTenantA))
      .expect(401);

    expect(
      (await h.requestPasswordReset('reset-scope-target@example.com')).status,
    ).toBe(202);
    const reset = await h.prisma.passwordResetToken.findFirstOrThrow({
      where: { userId: targetUserId },
      orderBy: { createdAt: 'desc' },
    });
    expect(reset.workspaceId).toBe(targetHomeWorkspaceId);
    expect(reset.workspaceId).not.toBe(workspaceA);

    await h
      .confirmPasswordReset(
        h.readPasswordResetToken('reset-scope-target@example.com'),
        'A reset scoped replacement 456',
      )
      .expect(204);
    expect(
      await h.prisma.auditLog.count({
        where: {
          workspaceId: workspaceA,
          actorUserId: targetUserId,
          action: 'password.reset.completed',
        },
      }),
    ).toBe(0);
    expect(
      await h.prisma.auditLog.count({
        where: {
          workspaceId: targetHomeWorkspaceId,
          actorUserId: targetUserId,
          action: 'password.reset.completed',
        },
      }),
    ).toBe(1);
    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', tenantACookie)
      .expect(200);
    await h
      .login(
        'reset-scope-target@example.com',
        'A reset scoped replacement 456',
        targetHomeWorkspaceId,
      )
      .then((response) => expect(response.status).toBe(201));
  });

  it('changes the password, invalidates reset links, and rotates only the current user sessions', async () => {
    const accountA = await h.register('password-change-a@example.com');
    const firstCookie = h.readCookieHeader(accountA);
    const secondSessionA = await h.login('password-change-a@example.com');
    const secondCookie = h.readCookieHeader(secondSessionA);
    const userA = h.readString(accountA.body as unknown, 'data', 'user', 'id');
    const workspaceA = h.readString(
      accountA.body as unknown,
      'data',
      'workspace',
      'id',
    );
    const originalSession = await h.prisma.session.findFirstOrThrow({
      where: {
        tokenHash: new h.OpaqueTokenService().hash(
          firstCookie.slice(firstCookie.indexOf('=') + 1),
        ),
      },
    });
    await h.requestPasswordReset('password-change-a@example.com');
    const oldResetToken = h.readPasswordResetToken(
      'password-change-a@example.com',
    );

    const accountB = await h.register('password-change-b@example.com');
    const userB = h.readString(accountB.body as unknown, 'data', 'user', 'id');
    const activeSessionsB = await h.prisma.session.count({
      where: { userId: userB, revokedAt: null },
    });

    const changed = await h.changePassword(
      firstCookie,
      'A secure passphrase 123',
      'A replacement passphrase 456',
    );

    expect(changed.status).toBe(204);
    expect(changed.headers['cache-control']).toBe('no-store');
    const rotatedCookie = h.readCookieHeader(changed);
    expect(rotatedCookie).not.toBe(firstCookie);
    expect(h.readSetCookie(changed)).toContain('HttpOnly');
    expect(h.readSetCookie(changed)).toContain('Secure');
    expect(h.readSetCookie(changed)).toContain('SameSite=Lax');
    expect(h.readSetCookie(changed)).toContain('Path=/');
    expect(h.readSetCookie(changed)).not.toContain('Domain=');

    const activeSessionsA = await h.prisma.session.findMany({
      where: { userId: userA, revokedAt: null },
    });
    expect(activeSessionsA).toHaveLength(1);
    expect(activeSessionsA[0]).toMatchObject({
      activeWorkspaceId: workspaceA,
      expiresAt: originalSession.expiresAt,
    });
    expect(
      await h.prisma.session.count({
        where: { userId: userB, revokedAt: null },
      }),
    ).toBe(activeSessionsB);
    expect(
      await h.prisma.passwordResetToken.count({
        where: { userId: userA, invalidatedAt: { not: null } },
      }),
    ).toBe(1);
    expect(
      await h.prisma.auditLog.count({
        where: {
          action: 'password.change.completed',
          actorUserId: userA,
          workspaceId: workspaceA,
        },
      }),
    ).toBe(1);

    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', firstCookie)
      .expect(401);
    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', secondCookie)
      .expect(401);
    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', rotatedCookie)
      .expect(200);
    expect((await h.login('password-change-a@example.com')).status).toBe(401);
    expect(
      (
        await h.login(
          'password-change-a@example.com',
          'A replacement passphrase 456',
        )
      ).status,
    ).toBe(201);
    await h
      .confirmPasswordReset(oldResetToken, 'Another replacement passphrase 789')
      .expect(400);
  });

  it('accepts normalized Unicode passwords up to the domain code-point limit', async () => {
    const currentPassword = '😀'.repeat(70);
    const decomposedReplacement = 'A re\u0301placement passphrase 456';
    const account = await h.registerWithPassword(
      'password-change-unicode@example.com',
      currentPassword,
    );

    const changed = await h.changePassword(
      h.readCookieHeader(account),
      currentPassword,
      decomposedReplacement,
    );

    expect(changed.status).toBe(204);
    expect(
      (
        await h.login(
          'password-change-unicode@example.com',
          decomposedReplacement.normalize('NFC'),
        )
      ).status,
    ).toBe(201);
  });

  it('requires a present, unexpired, and unrevoked session for password change', async () => {
    const missing = await h
      .request(h.app.getHttpServer())
      .put('/v1/auth/password')
      .set('Origin', h.allowedOrigin)
      .send({
        currentPassword: 'A secure passphrase 123',
        newPassword: 'A replacement passphrase 456',
      });
    expect(missing.status).toBe(401);
    expect(missing.headers['set-cookie']).toBeUndefined();

    const account = await h.register('password-change-session@example.com');
    const expiredCookie = h.readCookieHeader(account);
    await h.prisma.session.update({
      where: {
        tokenHash: new h.OpaqueTokenService().hash(
          expiredCookie.slice(expiredCookie.indexOf('=') + 1),
        ),
      },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    const expired = await h.changePassword(
      expiredCookie,
      'A secure passphrase 123',
      'A replacement passphrase 456',
    );
    expect(expired.status).toBe(401);
    expect(expired.headers['set-cookie']).toBeUndefined();

    const signedIn = await h.login('password-change-session@example.com');
    const revokedCookie = h.readCookieHeader(signedIn);
    await h
      .request(h.app.getHttpServer())
      .delete('/v1/auth/session')
      .set('Origin', h.allowedOrigin)
      .set('Cookie', revokedCookie)
      .expect(204);
    const revoked = await h.changePassword(
      revokedCookie,
      'A secure passphrase 123',
      'A replacement passphrase 456',
    );
    expect(revoked.status).toBe(401);
    expect(revoked.headers['set-cookie']).toBeUndefined();
    expect(
      await h.prisma.auditLog.count({
        where: { action: 'password.change.completed' },
      }),
    ).toBe(0);
    expect((await h.login('password-change-session@example.com')).status).toBe(
      201,
    );
  });

  it('keeps pending accounts out of authenticated password change without writes', async () => {
    const registration = await h.registerUnverified(
      'password-change-pending@example.com',
    );
    const cookie = h.readCookieHeader(registration);
    const credentialBefore =
      await h.prisma.passwordCredential.findFirstOrThrow();
    const sessionCount = await h.prisma.session.count();

    const response = await h.changePassword(
      cookie,
      'A secure passphrase 123',
      'A replacement passphrase 456',
    );

    expect(response.status).toBe(401);
    expect(h.readString(response.body as unknown, 'error', 'code')).toBe(
      'AUTHENTICATION_REQUIRED',
    );
    expect(
      (await h.prisma.passwordCredential.findFirstOrThrow()).passwordHash,
    ).toBe(credentialBefore.passwordHash);
    expect(await h.prisma.session.count()).toBe(sessionCount);
    expect(
      await h.prisma.auditLog.count({
        where: { action: 'password.change.completed' },
      }),
    ).toBe(0);
  });

  it('rejects wrong, unchanged, compromised, injected, and cross-origin password changes without writes', async () => {
    const account = await h.register('password-change-invalid@example.com');
    const cookie = h.readCookieHeader(account);
    const credentialBefore =
      await h.prisma.passwordCredential.findFirstOrThrow();
    const sessionCount = await h.prisma.session.count();
    const auditCount = await h.prisma.auditLog.count({
      where: { action: 'password.change.completed' },
    });

    const wrong = await h.changePassword(
      cookie,
      'A wrong passphrase 123',
      'A replacement passphrase 456',
    );
    expect(wrong.status).toBe(401);
    expect(h.readString(wrong.body as unknown, 'error', 'code')).toBe(
      'PASSWORD_CHANGE_INVALID_CURRENT_PASSWORD',
    );

    const unchanged = await h.changePassword(
      cookie,
      'A secure passphrase 123',
      'A secure passphrase 123',
    );
    expect(unchanged.status).toBe(400);
    expect(h.readString(unchanged.body as unknown, 'error', 'code')).toBe(
      'PASSWORD_CHANGE_INVALID_PASSWORD',
    );

    const compromised = await h.changePassword(
      cookie,
      'A secure passphrase 123',
      '123456789012345',
    );
    expect(compromised.status).toBe(400);
    expect(h.readString(compromised.body as unknown, 'error', 'code')).toBe(
      'PASSWORD_CHANGE_INVALID_PASSWORD',
    );

    const findSession = jest.spyOn(h.prisma.session, 'findUnique');
    await h
      .request(h.app.getHttpServer())
      .put('/v1/auth/password')
      .set('Origin', h.allowedOrigin)
      .set('Cookie', cookie)
      .send({
        currentPassword: 'A secure passphrase 123',
        newPassword: 'A replacement passphrase 456',
        workspaceId: h.randomUUID(),
        role: 'OWNER',
      })
      .expect(400);
    await h
      .request(h.app.getHttpServer())
      .put('/v1/auth/password')
      .set('Origin', 'https://attacker.example')
      .set('Cookie', cookie)
      .send({
        currentPassword: 'A secure passphrase 123',
        newPassword: 'A replacement passphrase 456',
      })
      .expect(403);
    expect(findSession).not.toHaveBeenCalled();

    expect(
      (await h.prisma.passwordCredential.findFirstOrThrow()).passwordHash,
    ).toBe(credentialBefore.passwordHash);
    expect(await h.prisma.session.count()).toBe(sessionCount);
    expect(
      await h.prisma.auditLog.count({
        where: { action: 'password.change.completed' },
      }),
    ).toBe(auditCount);
  });

  it('rolls back password change and emits no cookie when audit persistence fails', async () => {
    const account = await h.register('password-change-rollback@example.com');
    const cookie = h.readCookieHeader(account);
    await h.requestPasswordReset('password-change-rollback@example.com');
    const credentialBefore =
      await h.prisma.passwordCredential.findFirstOrThrow();
    const activeSessionsBefore = await h.prisma.session.count({
      where: { revokedAt: null },
    });
    jest
      .spyOn(h.auditLog, 'append')
      .mockRejectedValueOnce(new Error('audit unavailable'));

    const response = await h.changePassword(
      cookie,
      'A secure passphrase 123',
      'A replacement passphrase 456',
    );

    expect(response.status).toBe(503);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(
      (await h.prisma.passwordCredential.findFirstOrThrow()).passwordHash,
    ).toBe(credentialBefore.passwordHash);
    expect(await h.prisma.session.count({ where: { revokedAt: null } })).toBe(
      activeSessionsBefore,
    );
    expect(
      (await h.prisma.passwordResetToken.findFirstOrThrow()).invalidatedAt,
    ).toBeNull();
    await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', cookie)
      .expect(200);
  });

  it('allows only one concurrent change to reuse the old password', async () => {
    const account = await h.register('password-change-race@example.com');
    const cookie = h.readCookieHeader(account);
    const [first, second] = await Promise.all([
      h.changePassword(
        cookie,
        'A secure passphrase 123',
        'First concurrent replacement 456',
      ),
      h.changePassword(
        cookie,
        'A secure passphrase 123',
        'Second concurrent replacement 789',
      ),
    ]);

    expect([first.status, second.status].sort()).toEqual([204, 401]);
    const winningPassword =
      first.status === 204
        ? 'First concurrent replacement 456'
        : 'Second concurrent replacement 789';
    const losingPassword =
      first.status === 204
        ? 'Second concurrent replacement 789'
        : 'First concurrent replacement 456';
    expect(
      (await h.login('password-change-race@example.com', winningPassword))
        .status,
    ).toBe(201);
    expect(
      (await h.login('password-change-race@example.com', losingPassword))
        .status,
    ).toBe(401);
  });

  it('rate-limits password changes before current-password verification and fails closed', async () => {
    const account = await h.register('password-change-limited@example.com');
    const cookie = h.readCookieHeader(account);
    const verifyCurrent = jest.spyOn(
      h.passwordCredentialVerification,
      'verify',
    );
    jest
      .spyOn(h.authenticationRateLimiter, 'checkPasswordChange')
      .mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 60 });

    const limited = await h.changePassword(
      cookie,
      'A secure passphrase 123',
      'A replacement passphrase 456',
    );
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBe('60');
    expect(verifyCurrent).not.toHaveBeenCalled();

    jest.restoreAllMocks();
    const verifyAfterRestore = jest.spyOn(
      h.passwordCredentialVerification,
      'verify',
    );
    jest
      .spyOn(h.authenticationRateLimiter, 'checkPasswordChange')
      .mockRejectedValueOnce(new Error('redis unavailable'));
    const unavailable = await h.changePassword(
      cookie,
      'A secure passphrase 123',
      'A replacement passphrase 456',
    );
    expect(unavailable.status).toBe(503);
    expect(h.readString(unavailable.body as unknown, 'error', 'code')).toBe(
      'PASSWORD_CHANGE_UNAVAILABLE',
    );
    expect(verifyAfterRestore).not.toHaveBeenCalled();
  });
});
