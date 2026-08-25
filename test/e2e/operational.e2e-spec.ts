import { createE2eHarness, type E2eHarness } from './e2e-harness';

describe('Nexora API - Operational (e2e)', () => {
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

  it('preserves the starter health response', async () => {
    await h
      .request(h.app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('separates dependency-free liveness from dependency readiness', async () => {
    const live = await h
      .request(h.app.getHttpServer())
      .get('/health/live')
      .expect(200);
    expect(live.body).toEqual({ status: 'live' });
    expect(live.headers['x-content-type-options']).toBe('nosniff');
    expect(live.headers['x-frame-options']).toBe('DENY');
    expect(live.headers).not.toHaveProperty('x-powered-by');

    await h
      .request(h.app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect({
        status: 'ready',
        checks: { postgresql: 'up', redis: 'up' },
      });

    jest
      .spyOn(h.redis.client, 'ping')
      .mockRejectedValueOnce(new Error('secret'));
    const degraded = await h
      .request(h.app.getHttpServer())
      .get('/health/ready')
      .expect(503);
    expect(degraded.body).toEqual({
      status: 'not_ready',
      checks: { postgresql: 'up', redis: 'down' },
    });
    expect(JSON.stringify(degraded.body)).not.toContain('secret');
    await h.request(h.app.getHttpServer()).get('/health/live').expect(200);
  });

  it('uses an exact credentialed CORS allow-list', async () => {
    const allowed = await h
      .request(h.app.getHttpServer())
      .options('/health/live')
      .set('Origin', h.allowedOrigin)
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);
    expect(allowed.headers['access-control-allow-origin']).toBe(
      h.allowedOrigin,
    );
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    expect(allowed.headers['access-control-allow-methods']).toContain('PATCH');

    const denied = await h
      .request(h.app.getHttpServer())
      .options('/health/live')
      .set('Origin', 'https://attacker.example')
      .set('Access-Control-Request-Method', 'GET')
      .expect(404);
    expect(denied.headers).not.toHaveProperty('access-control-allow-origin');
  });

  it('keeps the adapter-mounted OpenAPI UI public in development', async () => {
    await h.request(h.app.getHttpServer()).get('/docs/').expect(200);
  });

  it('denies unclassified routes by default without exposing internals', async () => {
    const response = await h
      .request(h.app.getHttpServer())
      .get('/__test/route-admission/unclassified');

    expect(response.status).toBe(403);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({
      error: {
        code: 'ROUTE_ACCESS_DENIED',
        message: 'Access to this route is denied.',
        retryable: false,
      },
    });
    expect(h.unclassifiedRouteExecutions).toBe(0);
  });

  it('does not serialize arbitrary application-error details', async () => {
    const response = await h
      .request(h.app.getHttpServer())
      .get('/__test/route-admission/unsafe-error-details')
      .expect(500);

    expect(response.body).toMatchObject({
      error: {
        code: 'UNSAFE_DETAILS_TEST',
        message: 'Safe public message.',
        retryable: false,
      },
    });
    expect(h.hasPath(response.body as unknown, 'error', 'details')).toBe(false);
    expect(JSON.stringify(response.body)).not.toContain('must-not-leak');
    expect(JSON.stringify(response.body)).not.toContain('select sensitive');

    const selection = await h
      .request(h.app.getHttpServer())
      .get('/__test/route-admission/unsafe-workspace-selection-details')
      .expect(409);
    expect(selection.body).toMatchObject({
      error: {
        details: {
          availableWorkspaces: [
            {
              organization: { id: 'organization-id', name: 'Organization' },
              workspace: { id: 'workspace-id', name: 'Workspace' },
              membership: { role: 'OWNER' },
            },
          ],
        },
      },
    });
    expect(JSON.stringify(selection.body)).not.toContain('must-not-leak');
    expect(JSON.stringify(selection.body)).not.toContain('select sensitive');
  });

  it('requires active status by default and permits pending users only by explicit policy', async () => {
    const email = 'route-admission@example.com';
    const registration = await h.registerUnverified(email);
    const cookie = h.readCookieHeader(registration);

    const pendingAllowed = await h
      .request(h.app.getHttpServer())
      .get('/__test/route-admission/pending')
      .set('Cookie', cookie)
      .expect(200);
    expect(pendingAllowed.body).toMatchObject({
      actorUserId: h.readString(
        registration.body as unknown,
        'data',
        'user',
        'id',
      ),
      userStatus: 'PENDING_VERIFICATION',
      workspaceId: h.readString(
        registration.body as unknown,
        'data',
        'workspace',
        'id',
      ),
    });

    const activeOnly = await h
      .request(h.app.getHttpServer())
      .get('/__test/route-admission/active')
      .set('Cookie', cookie)
      .set('X-User-Status', 'ACTIVE');
    expect(activeOnly.status).toBe(403);
    expect(activeOnly.headers['cache-control']).toBe('no-store');
    expect(h.readString(activeOnly.body as unknown, 'error', 'code')).toBe(
      'EMAIL_VERIFICATION_REQUIRED',
    );

    await h.confirmEmail(await h.readVerificationToken(email)).expect(204);
    const active = await h
      .request(h.app.getHttpServer())
      .get('/__test/route-admission/active')
      .set('Cookie', cookie)
      .expect(200);
    expect(active.body).toMatchObject({ userStatus: 'ACTIVE' });
  });

  it('requires a valid opaque session for every authenticated route', async () => {
    const response = await h
      .request(h.app.getHttpServer())
      .get('/__test/route-admission/active');

    expect(response.status).toBe(401);
    expect(h.readString(response.body as unknown, 'error', 'code')).toBe(
      'AUTHENTICATION_REQUIRED',
    );
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
