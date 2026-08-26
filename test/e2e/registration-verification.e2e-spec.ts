import { createE2eHarness, type E2eHarness } from './e2e-harness';

describe('Nexora API - Registration and Verification (e2e)', () => {
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
});
