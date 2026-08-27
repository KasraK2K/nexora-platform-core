import { createE2eHarness, type E2eHarness } from './e2e-harness';

describe('Nexora operational boundaries (e2e)', () => {
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

  it('removes the starter route and keeps health, CORS, and docs operational', async () => {
    await h.request(h.app.getHttpServer()).get('/').expect(404);
    await h
      .request(h.app.getHttpServer())
      .patch('/v1/memberships/00000000-0000-0000-0000-000000000000/role')
      .expect(404);
    await h
      .request(h.app.getHttpServer())
      .put('/v1/memberships/owner')
      .expect(404);
    await h
      .request(h.app.getHttpServer())
      .get('/health/live')
      .expect(200)
      .expect({ status: 'live' });
    await h
      .request(h.app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect({
        status: 'ready',
        checks: { postgresql: 'up', redis: 'up' },
      });
    const cors = await h
      .request(h.app.getHttpServer())
      .options('/health/live')
      .set('Origin', h.allowedOrigin)
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);
    expect(cors.headers['access-control-allow-origin']).toBe(h.allowedOrigin);
    await h.request(h.app.getHttpServer()).get('/docs/').expect(200);
  });

  it('installs deny-by-default admission and sanitizes error details', async () => {
    const denied = await h
      .request(h.app.getHttpServer())
      .get('/__test/route-admission/unclassified')
      .expect(403);
    expect(h.readString(denied.body, 'error', 'code')).toBe(
      'ROUTE_ACCESS_DENIED',
    );
    expect(h.unclassifiedRouteExecutions).toBe(0);

    const unsafe = await h
      .request(h.app.getHttpServer())
      .get('/__test/route-admission/unsafe-error-details')
      .expect(500);
    expect(JSON.stringify(unsafe.body)).not.toContain('must-not-leak');
    expect(JSON.stringify(unsafe.body)).not.toContain('select sensitive');

    const selection = await h
      .request(h.app.getHttpServer())
      .get('/__test/route-admission/unsafe-workspace-selection-details')
      .expect(409);
    expect(
      h.readArray(selection.body, 'error', 'details', 'availableWorkspaces'),
    ).toEqual([
      {
        workspace: { id: 'workspace-id', name: 'Workspace' },
        membership: { role: 'OWNER' },
      },
    ]);
  });
});
