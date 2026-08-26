import { Test } from '@nestjs/testing';
import { AppConfig } from '../../../config/app-config';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { MembershipOwnershipTransferRateLimiter } from './redis-membership-ownership-transfer-rate-limiter';

describe('MembershipOwnershipTransferRateLimiter', () => {
  const counts = new Map<string, number>();
  const evalMock = jest.fn(
    (_script: string, options: { keys: string[] }): Promise<unknown> => {
      const key = options.keys[0];
      const current = (counts.get(key) ?? 0) + 1;
      counts.set(key, current);
      return Promise.resolve([current, 900]);
    },
  );
  let limiter: MembershipOwnershipTransferRateLimiter;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MembershipOwnershipTransferRateLimiter,
        { provide: RedisService, useValue: { client: { eval: evalMock } } },
        {
          provide: AppConfig,
          useValue: {
            rateLimitKeySecret: 'unit-test-rate-limit-secret-value',
          },
        },
      ],
    }).compile();
    limiter = module.get(MembershipOwnershipTransferRateLimiter);
  });

  beforeEach(() => {
    counts.clear();
    evalMock.mockClear();
  });

  it('allows five session-workspace attempts and rejects the sixth', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        limiter.check({
          clientIp: '192.0.2.1',
          sessionId: 'session-a',
          workspaceId: 'workspace-a',
        }),
      ).resolves.toEqual({ allowed: true, retryAfterSeconds: 900 });
    }

    await expect(
      limiter.check({
        clientIp: '192.0.2.1',
        sessionId: 'session-a',
        workspaceId: 'workspace-a',
      }),
    ).resolves.toEqual({ allowed: false, retryAfterSeconds: 900 });
  });

  it('allows twenty IP attempts and rejects the twenty-first', async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await expect(
        limiter.check({
          clientIp: '192.0.2.2',
          sessionId: `session-${attempt}`,
          workspaceId: 'workspace-a',
        }),
      ).resolves.toEqual({ allowed: true, retryAfterSeconds: 900 });
    }

    await expect(
      limiter.check({
        clientIp: '192.0.2.2',
        sessionId: 'session-21',
        workspaceId: 'workspace-a',
      }),
    ).resolves.toEqual({ allowed: false, retryAfterSeconds: 900 });
  });

  it('fails closed when Redis returns a malformed script result', async () => {
    evalMock.mockResolvedValueOnce('malformed');

    await expect(
      limiter.check({
        clientIp: '192.0.2.3',
        sessionId: 'session-a',
        workspaceId: 'workspace-a',
      }),
    ).resolves.toEqual({ allowed: false, retryAfterSeconds: 900 });
  });
});
