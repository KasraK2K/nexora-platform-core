import { createE2eHarness, type E2eHarness } from './e2e-harness';

describe('Nexora lean authentication and mail security (e2e)', () => {
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

  it('keeps trusted-origin, validation, and secure-cookie behavior', async () => {
    await h
      .request(h.app.getHttpServer())
      .post('/v1/auth/registrations')
      .set('Origin', 'https://attacker.example')
      .send({
        email: 'owner@example.test',
        password: h.defaultPassword,
        displayName: 'Owner',
        workspaceName: 'Workspace',
      })
      .expect(403);

    await h
      .request(h.app.getHttpServer())
      .post('/v1/auth/registrations')
      .set('Origin', h.allowedOrigin)
      .send({
        email: 'owner@example.test',
        password: 'short',
        displayName: 'Owner',
        workspaceName: 'Workspace',
        unexpected: true,
      })
      .expect(400);

    const registration = await h
      .registerUnverified('owner@example.test')
      .expect(201);
    const cookie = h.readSetCookie(registration);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
  });

  it('rotates the current session and revokes every old session on password change', async () => {
    const registration = await h.register('owner@example.test');
    const firstCookie = h.readCookieHeader(registration);
    const secondLogin = await h.login('owner@example.test').expect(201);
    const secondCookie = h.readCookieHeader(secondLogin);
    const newPassword = 'A replacement passphrase 456';

    const changed = await h
      .changePassword(firstCookie, h.defaultPassword, newPassword)
      .expect(204);
    const replacementCookie = h.readCookieHeader(changed);
    await h.currentSession(firstCookie).expect(401);
    await h.currentSession(secondCookie).expect(401);
    await h.currentSession(replacementCookie).expect(200);
    await h.login('owner@example.test', h.defaultPassword).expect(401);
    await h.login('owner@example.test', newPassword).expect(201);
  });

  it('revokes the current session and then every remaining user session', async () => {
    const registration = await h.register('owner@example.test');
    const firstCookie = h.readCookieHeader(registration);
    const secondLogin = await h.login('owner@example.test').expect(201);
    const secondCookie = h.readCookieHeader(secondLogin);

    const logout = await h
      .request(h.app.getHttpServer())
      .delete('/v1/auth/session')
      .set('Origin', h.allowedOrigin)
      .set('Cookie', firstCookie)
      .expect(204);
    expect(h.readSetCookie(logout)).toContain('Max-Age=0');
    await h.currentSession(firstCookie).expect(401);
    await h.currentSession(secondCookie).expect(200);

    const logoutEverywhere = await h
      .request(h.app.getHttpServer())
      .delete('/v1/auth/sessions')
      .set('Origin', h.allowedOrigin)
      .set('Cookie', secondCookie)
      .expect(204);
    expect(h.readSetCookie(logoutEverywhere)).toContain('Max-Age=0');
    await h.currentSession(secondCookie).expect(401);
  });

  it('keeps distributed password-reset rate limiting and safe errors', async () => {
    for (let request = 0; request < 5; request += 1) {
      await h.requestPasswordReset('missing@example.test').expect(202);
    }
    const blocked = await h
      .requestPasswordReset('missing@example.test')
      .expect(429);
    expect(h.readString(blocked.body, 'error', 'code')).toBe(
      'PASSWORD_RESET_RATE_LIMITED',
    );
    expect(blocked.headers).toHaveProperty('retry-after');
  });

  it('queues password reset without enumeration and revokes existing sessions', async () => {
    const registration = await h.register('owner@example.test');
    const cookie = h.readCookieHeader(registration);
    await h.requestPasswordReset('missing@example.test').expect(202);
    expect(await h.prisma.passwordResetToken.count()).toBe(0);

    await h.requestPasswordReset('owner@example.test').expect(202);
    expect(h.resetDeliveries).toHaveLength(0);
    const pending = await h.prisma.passwordResetToken.findFirstOrThrow();
    await expect(
      h.prisma.mailOutboxMessage.findUniqueOrThrow({
        where: { id: pending.id },
      }),
    ).resolves.toMatchObject({ status: 'PENDING', purpose: 'PASSWORD_RESET' });
    await h.drainMail();
    const token = h.readDeliveryToken(h.resetDeliveries, 'owner@example.test');
    const newPassword = 'A reset passphrase 789';
    const reset = await h.resetPassword(token, newPassword).expect(204);
    expect(h.readSetCookie(reset)).toContain('Max-Age=0');
    await h.currentSession(cookie).expect(401);
    await h.resetPassword(token, newPassword).expect(400);
    await h.login('owner@example.test', newPassword).expect(201);
  });

  it('uses the encrypted outbox as the only delivery authority', async () => {
    const response = await h
      .registerUnverified('owner@example.test')
      .expect(201);
    const outbox = await h.prisma.mailOutboxMessage.findFirstOrThrow();
    const verification = await h.prisma.emailVerification.findFirstOrThrow();
    expect(outbox.status).toBe('PENDING');
    expect(outbox.encryptedPayload).not.toContain('owner@example.test');
    expect(Object.keys(verification)).not.toContain('deliveryStatus');
    expect(Object.keys(verification)).not.toContain('deliveryAttemptedAt');
    expect(response.body).toMatchObject({
      meta: { verificationEmailQueued: true },
    });

    await h.drainMail();
    await expect(
      h.prisma.mailOutboxMessage.findUniqueOrThrow({
        where: { id: outbox.id },
      }),
    ).resolves.toMatchObject({ status: 'SENT', encryptedPayload: '' });
  });
});
