import { createE2eHarness, type E2eHarness } from './e2e-harness';

describe('Nexora API - Authentication (e2e)', () => {
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

  it('registers one complete account graph and resolves its trusted workspace', async () => {
    const registration = await h.register('Owner@Example.com');

    expect(registration.status).toBe(201);
    expect(registration.headers['cache-control']).toBe('no-store');
    expect(registration.body).toMatchObject({
      data: {
        user: { displayName: 'Owner' },
        organization: { name: 'Nexora Customer' },
        workspace: { name: 'Main Workspace' },
        membership: { role: 'OWNER' },
      },
      meta: {},
    });
    expect(JSON.stringify(registration.body)).not.toContain(
      'A secure passphrase 123',
    );
    expect(JSON.stringify(registration.body)).not.toContain('argon2');

    const setCookie = registration.headers['set-cookie'] as unknown as string[];
    expect(setCookie).toHaveLength(1);
    expect(setCookie[0]).toContain('__Host-nexora_session=');
    expect(setCookie[0]).toContain('HttpOnly');
    expect(setCookie[0]).toContain('Secure');
    expect(setCookie[0]).toContain('SameSite=Lax');
    expect(setCookie[0]).toContain('Path=/');
    expect(setCookie[0]).not.toContain('Domain=');

    const [
      identity,
      credential,
      user,
      organization,
      workspace,
      membership,
      session,
      audit,
    ] = await Promise.all([
      h.prisma.identity.findFirstOrThrow(),
      h.prisma.passwordCredential.findFirstOrThrow(),
      h.prisma.user.findFirstOrThrow(),
      h.prisma.organization.findFirstOrThrow(),
      h.prisma.workspace.findFirstOrThrow(),
      h.prisma.membership.findFirstOrThrow(),
      h.prisma.session.findFirstOrThrow(),
      h.prisma.auditLog.findFirstOrThrow(),
    ]);

    expect(identity.normalizedEmail).toBe('owner@example.com');
    expect(credential.passwordHash).not.toBe('A secure passphrase 123');
    await expect(
      h.verify(credential.passwordHash, 'A secure passphrase 123'),
    ).resolves.toBe(true);
    expect(user.identityId).toBe(identity.id);
    expect(organization.ownerUserId).toBe(user.id);
    expect(workspace.organizationId).toBe(organization.id);
    expect(membership).toMatchObject({
      userId: user.id,
      workspaceId: workspace.id,
      role: 'OWNER',
    });
    expect(session).toMatchObject({
      userId: user.id,
      activeWorkspaceId: workspace.id,
    });
    expect(session.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(audit).toMatchObject({
      workspaceId: workspace.id,
      actorUserId: user.id,
      action: 'account.registered',
    });

    const cookie = setCookie[0].split(';', 1)[0];
    expect(cookie).not.toContain(session.tokenHash);
    const rawToken = cookie.slice(cookie.indexOf('=') + 1);
    const sessionKeys = await h.redis.client.keys('auth:session:*');
    expect(sessionKeys).toEqual([`auth:session:${session.tokenHash}`]);
    expect(sessionKeys[0]).not.toContain(rawToken);
    const current = await h
      .request(h.app.getHttpServer())
      .get('/v1/auth/session')
      .set('Cookie', cookie)
      .expect(200);
    expect(current.headers['cache-control']).toBe('no-store');
    expect(
      h.readString(current.body as unknown, 'data', 'workspace', 'id'),
    ).toBe(workspace.id);
    expect(h.readString(current.body as unknown, 'data', 'user', 'id')).toBe(
      user.id,
    );
  });

  it('requires email verification before login and rejects token replay', async () => {
    const registration = await h.registerUnverified('verify-me@example.com');

    expect(registration.status).toBe(201);
    expect(registration.body).toMatchObject({
      data: {
        user: { status: 'PENDING_VERIFICATION' },
      },
      meta: {
        verificationRequired: true,
        verificationEmailSent: true,
      },
    });
    await h
      .login('verify-me@example.com')
      .then((response) => expect(response.status).toBe(401));

    const token = await h.readVerificationToken('verify-me@example.com');
    const stored = await h.prisma.emailVerification.findFirstOrThrow();
    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.tokenHash).not.toBe(token);

    await h.confirmEmail(token).expect(204);
    expect((await h.prisma.user.findFirstOrThrow()).status).toBe('ACTIVE');
    expect(
      (await h.prisma.emailVerification.findFirstOrThrow()).consumedAt,
    ).not.toBeNull();
    await h.confirmEmail(token).expect(400);
    await h
      .login('verify-me@example.com')
      .then((response) => expect(response.status).toBe(201));
  });

  it('returns a generic resend response and replaces earlier links', async () => {
    await h.registerUnverified('resend@example.com');
    const firstToken = await h.readVerificationToken('resend@example.com');

    const missing = await h
      .request(h.app.getHttpServer())
      .post('/v1/auth/email-verification-requests')
      .set('Origin', h.allowedOrigin)
      .send({ email: 'missing@example.com' });
    const existing = await h
      .request(h.app.getHttpServer())
      .post('/v1/auth/email-verification-requests')
      .set('Origin', h.allowedOrigin)
      .send({ email: ' RESEND@Example.com ' });

    expect(missing.status).toBe(202);
    expect(existing.status).toBe(202);
    expect(existing.body).toEqual(missing.body);
    const secondToken = await h.readVerificationToken(
      'resend@example.com',
      firstToken,
    );
    expect(secondToken).not.toBe(firstToken);
    await h.confirmEmail(firstToken).expect(400);
    await h.confirmEmail(secondToken).expect(204);
    expect(
      await h.prisma.emailVerification.count({
        where: { invalidatedAt: { not: null } },
      }),
    ).toBe(1);
  });

  it('rejects an expired verification link without activating the user', async () => {
    await h.registerUnverified('expired@example.com');
    const token = await h.readVerificationToken('expired@example.com');
    await h.prisma.emailVerification.updateMany({
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    await h.confirmEmail(token).expect(400);
    expect((await h.prisma.user.findFirstOrThrow()).status).toBe(
      'PENDING_VERIFICATION',
    );
  });

  it('keeps verification replacement and confirmation isolated between tenants', async () => {
    const tenantA = await h.registerUnverified(
      'verification-matrix-a@example.com',
    );
    const tenantB = await h.registerUnverified(
      'verification-matrix-b@example.com',
    );
    const userA = h.readString(tenantA.body as unknown, 'data', 'user', 'id');
    const userB = h.readString(tenantB.body as unknown, 'data', 'user', 'id');
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
    const firstTokenA = await h.readVerificationToken(
      'verification-matrix-a@example.com',
    );
    const tokenB = await h.readVerificationToken(
      'verification-matrix-b@example.com',
    );

    await h
      .request(h.app.getHttpServer())
      .post('/v1/auth/email-verification-requests')
      .set('Origin', h.allowedOrigin)
      .send({ email: 'verification-matrix-a@example.com' })
      .expect(202);
    const replacementTokenA = await h.readVerificationToken(
      'verification-matrix-a@example.com',
      firstTokenA,
    );
    await h.confirmEmail(firstTokenA).expect(400);
    await h.confirmEmail(replacementTokenA).expect(204);

    await expect(
      h.prisma.user.findUniqueOrThrow({ where: { id: userA } }),
    ).resolves.toMatchObject({ status: 'ACTIVE' });
    await expect(
      h.prisma.user.findUniqueOrThrow({ where: { id: userB } }),
    ).resolves.toMatchObject({ status: 'PENDING_VERIFICATION' });
    expect(
      await h.prisma.auditLog.count({
        where: {
          workspaceId: workspaceA,
          actorUserId: userA,
          action: 'email.verified',
        },
      }),
    ).toBe(1);
    expect(
      await h.prisma.auditLog.count({
        where: {
          workspaceId: workspaceB,
          action: 'email.verified',
        },
      }),
    ).toBe(0);

    await h.confirmEmail(tokenB).expect(204);
    await expect(
      h.prisma.user.findUniqueOrThrow({ where: { id: userB } }),
    ).resolves.toMatchObject({ status: 'ACTIVE' });
  });

  it('commits registration and records a failed delivery attempt', async () => {
    jest
      .spyOn(h.recordingEmailSender, 'send')
      .mockRejectedValueOnce(new Error('mail provider unavailable'));

    const response = await h.registerUnverified('delivery-failed@example.com');

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      data: { user: { status: 'PENDING_VERIFICATION' } },
      meta: { verificationEmailSent: false },
    });
    expect(
      (await h.prisma.emailVerification.findFirstOrThrow()).deliveryStatus,
    ).toBe('FAILED');
    const outbox = await h.prisma.mailOutboxMessage.findFirstOrThrow();
    expect(outbox.status).toBe('RETRY_SCHEDULED');
    expect(outbox.attemptCount).toBe(1);
    expect(outbox.encryptedPayload).not.toContain(
      'delivery-failed@example.com',
    );
    expect(outbox.encryptedPayload).not.toContain('token=');
  });

  it('expires abandoned processing mail without stealing an active lease', async () => {
    const workspaceId = await h.createMailOutboxWorkspace(h.prisma);
    const now = new Date('2099-01-02T00:00:00.000Z');
    const abandonedId = h.randomUUID();
    const activeId = h.randomUUID();
    const activeLease = new Date('2099-01-03T00:00:00.000Z');
    await h.prisma.mailOutboxMessage.createMany({
      data: [
        h.processingMailMessage({
          id: abandonedId,
          workspaceId,
          suffix: 'abandoned',
          expiresAt: new Date('2099-01-01T00:00:00.000Z'),
          lockedUntil: new Date('2099-01-01T23:59:00.000Z'),
        }),
        h.processingMailMessage({
          id: activeId,
          workspaceId,
          suffix: 'active',
          expiresAt: new Date('2099-01-01T00:00:00.000Z'),
          lockedUntil: activeLease,
        }),
      ],
    });

    await expect(h.mailOutboxRepository.expireDue(now, 3)).resolves.toBe(1);
    await expect(
      h.prisma.mailOutboxMessage.findUniqueOrThrow({
        where: { id: abandonedId },
      }),
    ).resolves.toMatchObject({
      status: 'FAILED',
      failedAt: now,
      lockedUntil: null,
      encryptedPayload: '',
    });
    await expect(
      h.prisma.mailOutboxMessage.findUniqueOrThrow({ where: { id: activeId } }),
    ).resolves.toMatchObject({
      status: 'PROCESSING',
      failedAt: null,
      lockedUntil: activeLease,
      encryptedPayload: 'encrypted-sensitive-payload',
    });

    const afterActiveLease = new Date('2099-01-04T00:00:00.000Z');
    await expect(
      h.mailOutboxRepository.expireDue(afterActiveLease, 3),
    ).resolves.toBe(1);
    await expect(
      h.prisma.mailOutboxMessage.findUniqueOrThrow({ where: { id: activeId } }),
    ).resolves.toMatchObject({
      status: 'FAILED',
      failedAt: afterActiveLease,
      lockedUntil: null,
      encryptedPayload: '',
    });
  });

  it('renews a live mail lease and rejects every stale completion after reclaim', async () => {
    const workspaceId = await h.createMailOutboxWorkspace(h.prisma);
    const id = h.randomUUID();
    const firstClaimAt = new Date('2099-01-02T00:00:00.000Z');
    const firstLease = new Date('2099-01-02T00:01:00.000Z');
    const renewalAt = new Date('2099-01-02T00:00:30.000Z');
    const renewedLease = new Date('2099-01-02T00:03:00.000Z');
    const blockedClaimAt = new Date('2099-01-02T00:02:00.000Z');
    const secondClaimAt = new Date('2099-01-02T00:04:00.000Z');
    const secondLease = new Date('2099-01-02T00:05:00.000Z');
    await h.prisma.mailOutboxMessage.create({
      data: {
        id,
        workspaceId,
        purpose: 'EMAIL_VERIFICATION',
        idempotencyKey: `EMAIL_VERIFICATION:${id}`,
        messageId: `<${id}@mail.example.test>`,
        encryptedPayload: 'encrypted-sensitive-payload',
        correlationId: id,
        expiresAt: new Date('2099-01-03T00:00:00.000Z'),
        nextAttemptAt: firstClaimAt,
      },
    });

    const firstClaim = await h.mailOutboxRepository.claim(
      id,
      firstClaimAt,
      firstLease,
      3,
    );
    if (!firstClaim)
      throw new Error('Expected the first mail claim to succeed');
    await expect(
      h.mailOutboxRepository.renewLease({
        id,
        attemptCount: firstClaim.attemptCount,
        now: renewalAt,
        lockedUntil: renewedLease,
      }),
    ).resolves.toBe(true);
    await expect(
      h.mailOutboxRepository.claim(
        id,
        blockedClaimAt,
        new Date('2099-01-02T00:02:30.000Z'),
        3,
      ),
    ).resolves.toBeNull();
    const secondClaim = await h.mailOutboxRepository.claim(
      id,
      secondClaimAt,
      secondLease,
      3,
    );
    if (!secondClaim) throw new Error('Expected the reclaimed mail to succeed');

    expect(firstClaim.attemptCount).toBe(1);
    expect(secondClaim.attemptCount).toBe(2);
    await expect(
      h.mailOutboxRepository.markSent({
        id,
        attemptCount: firstClaim.attemptCount,
        sentAt: secondClaimAt,
      }),
    ).rejects.toThrow('Mail outbox state transition failed');
    await expect(
      h.mailOutboxRepository.markRetry({
        id,
        attemptCount: firstClaim.attemptCount,
        attemptedAt: secondClaimAt,
        nextAttemptAt: new Date('2099-01-02T00:04:00.000Z'),
      }),
    ).rejects.toThrow('Mail outbox state transition failed');
    await expect(
      h.mailOutboxRepository.markFailed({
        id,
        attemptCount: firstClaim.attemptCount,
        failedAt: secondClaimAt,
      }),
    ).rejects.toThrow('Mail outbox state transition failed');

    await expect(
      h.prisma.mailOutboxMessage.findUniqueOrThrow({ where: { id } }),
    ).resolves.toMatchObject({
      status: 'PROCESSING',
      attemptCount: secondClaim.attemptCount,
      lastAttemptAt: secondClaimAt,
      lockedUntil: secondLease,
      sentAt: null,
      failedAt: null,
      encryptedPayload: 'encrypted-sensitive-payload',
    });

    await h.mailOutboxRepository.markSent({
      id,
      attemptCount: secondClaim.attemptCount,
      sentAt: secondClaimAt,
    });
    await expect(
      h.prisma.mailOutboxMessage.findUniqueOrThrow({ where: { id } }),
    ).resolves.toMatchObject({
      status: 'SENT',
      sentAt: secondClaimAt,
      lockedUntil: null,
      encryptedPayload: '',
    });
  });

  it('terminally erases an exhausted abandoned mail attempt', async () => {
    const workspaceId = await h.createMailOutboxWorkspace(h.prisma);
    const id = h.randomUUID();
    const now = new Date('2099-01-02T00:00:00.000Z');
    await h.prisma.mailOutboxMessage.create({
      data: h.processingMailMessage({
        id,
        workspaceId,
        suffix: 'attempts-exhausted',
        attemptCount: 3,
        expiresAt: new Date('2099-02-01T00:00:00.000Z'),
        lockedUntil: new Date('2099-01-01T23:59:00.000Z'),
      }),
    });

    await expect(
      h.mailOutboxRepository.findDueIds(now, 10, 3),
    ).resolves.not.toContain(id);
    await expect(
      h.mailOutboxRepository.claim(
        id,
        now,
        new Date('2099-01-02T00:01:00.000Z'),
        3,
      ),
    ).resolves.toBeNull();
    await expect(h.mailOutboxRepository.expireDue(now, 3)).resolves.toBe(1);
    await expect(
      h.prisma.mailOutboxMessage.findUniqueOrThrow({ where: { id } }),
    ).resolves.toMatchObject({
      status: 'FAILED',
      attemptCount: 3,
      failedAt: now,
      lockedUntil: null,
      encryptedPayload: '',
    });
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
        tokenHash: new h.SessionTokenService().hash(
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
        tokenHash: new h.SessionTokenService().hash(
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

  it('rejects equivalent duplicate emails and remains race-safe', async () => {
    const [first, second] = await Promise.all([
      h.register('race@example.com'),
      h.register('  RACE@EXAMPLE.COM  '),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 409]);
    expect(await h.prisma.identity.count()).toBe(1);
    expect(await h.prisma.user.count()).toBe(1);
    expect(await h.prisma.organization.count()).toBe(1);
    expect(await h.prisma.workspace.count()).toBe(1);
    expect(await h.prisma.membership.count()).toBe(1);
  });

  it('rejects untrusted fields and disallowed origins before creating data', async () => {
    const privileged = await h
      .request(h.app.getHttpServer())
      .post('/v1/auth/registrations')
      .set('Origin', h.allowedOrigin)
      .send({
        ...h.registrationBody('fields@example.com'),
        role: 'ADMIN',
        workspaceId: 'attacker',
      });
    expect(privileged.status).toBe(400);
    expect(h.readString(privileged.body as unknown, 'error', 'code')).toBe(
      'VALIDATION_FAILED',
    );

    const crossOrigin = await h
      .request(h.app.getHttpServer())
      .post('/v1/auth/registrations')
      .set('Origin', 'https://attacker.example')
      .send(h.registrationBody('origin@example.com'));
    expect(crossOrigin.status).toBe(403);
    expect(h.readString(crossOrigin.body as unknown, 'error', 'code')).toBe(
      'ORIGIN_NOT_ALLOWED',
    );

    const missingOrigin = await h
      .request(h.app.getHttpServer())
      .post('/v1/auth/registrations')
      .send(h.registrationBody('missing-origin@example.com'));
    expect(missingOrigin.status).toBe(403);
    expect(h.readString(missingOrigin.body as unknown, 'error', 'code')).toBe(
      'ORIGIN_NOT_ALLOWED',
    );
    expect(await h.prisma.identity.count()).toBe(0);
  });

  it('rejects a locally blocklisted password before creating data', async () => {
    const response = await h
      .request(h.app.getHttpServer())
      .post('/v1/auth/registrations')
      .set('Origin', h.allowedOrigin)
      .send({
        ...h.registrationBody('compromised-password@example.com'),
        password: '123456789012345',
      });

    expect(response.status).toBe(400);
    expect(h.readString(response.body as unknown, 'error', 'code')).toBe(
      'REGISTRATION_INVALID',
    );
    expect(await h.prisma.identity.count()).toBe(0);
    expect(await h.prisma.passwordCredential.count()).toBe(0);
  });

  it('rate-limits repeated registration attempts before password hashing', async () => {
    const hash = jest
      .spyOn(h.passwordHasher, 'hash')
      .mockResolvedValue('$argon2id$test-hash');
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await h
        .request(h.app.getHttpServer())
        .post('/v1/auth/registrations')
        .set('Origin', h.allowedOrigin)
        .set('X-Forwarded-For', '203.0.113.10')
        .send({
          ...h.registrationBody(`limited-${attempt}@example.com`),
          password: 'A secure passphrase 123',
        });
      expect(response.status).toBe(201);
    }

    const limited = await h
      .request(h.app.getHttpServer())
      .post('/v1/auth/registrations')
      .set('Origin', h.allowedOrigin)
      .set('X-Forwarded-For', '203.0.113.10')
      .send({
        ...h.registrationBody('limited-final@example.com'),
        password: 'A secure passphrase 123',
      });
    expect(limited.status).toBe(429);
    expect(h.readString(limited.body as unknown, 'error', 'code')).toBe(
      'REGISTRATION_RATE_LIMITED',
    );
    expect(limited.headers['retry-after']).toBeDefined();
    expect(hash).toHaveBeenCalledTimes(10);

    const independentClient = await h
      .request(h.app.getHttpServer())
      .post('/v1/auth/registrations')
      .set('Origin', h.allowedOrigin)
      .set('X-Forwarded-For', '203.0.113.11')
      .send(h.registrationBody('independent@example.com'));
    expect(independentClient.status).toBe(201);
    expect(hash).toHaveBeenCalledTimes(11);
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
    const selectedTokenHash = new h.SessionTokenService().hash(
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

    const replacementHash = new h.SessionTokenService().hash(
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
