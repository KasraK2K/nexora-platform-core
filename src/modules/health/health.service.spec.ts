import { HealthService } from './health.service';

describe('HealthService', () => {
  const config = { dependencyHealthTimeoutMs: 25 };
  const telemetry = { recordDependencyCheck: jest.fn() };

  beforeEach(() => telemetry.recordDependencyCheck.mockClear());

  it('reports ready only when PostgreSQL and Redis are healthy', async () => {
    const service = createService(
      () => Promise.resolve([1]),
      () => Promise.resolve('PONG'),
    );
    await expect(service.readiness()).resolves.toEqual({
      ready: true,
      checks: { postgresql: 'up', redis: 'up' },
    });
  });

  it('returns a safe degraded result when a dependency fails', async () => {
    const service = createService(
      () => Promise.reject(new Error('secret db error')),
      () => Promise.resolve('PONG'),
    );
    await expect(service.readiness()).resolves.toEqual({
      ready: false,
      checks: { postgresql: 'down', redis: 'up' },
    });
  });

  it('becomes unready before shutdown without probing dependencies', async () => {
    const service = createService(
      () => Promise.resolve([1]),
      () => Promise.resolve('PONG'),
    );
    service.markShuttingDown();
    await expect(service.readiness()).resolves.toMatchObject({ ready: false });
  });

  function createService(
    database: () => Promise<unknown>,
    redis: () => Promise<unknown>,
  ) {
    return new HealthService(
      { ping: database } as never,
      { client: { ping: redis } } as never,
      config as never,
      telemetry as never,
    );
  }
});
