import type { AppConfig } from '../../config/app-config';
import type { RedisService } from './redis.service';
import { RedisFixedWindowRateLimiter } from './redis-fixed-window-rate-limiter';

describe('RedisFixedWindowRateLimiter', () => {
  it.each([
    ['wrong length', ['unexpected']],
    ['empty strings', ['', '']],
    ['non-numeric values', ['count', 'ttl']],
    ['invalid count', [0, 100]],
    ['missing expiry', [1, -1]],
    ['oversized expiry', [1, 901]],
  ])('fails closed with the full window for %s', async (_label, result) => {
    const evalScript = jest.fn().mockResolvedValue(result);
    const redis = { client: { eval: evalScript } } as unknown as RedisService;
    const config = { rateLimitKeySecret: 'secret' } as AppConfig;
    const limiter = new RedisFixedWindowRateLimiter(redis, config);

    await expect(limiter.increment('bucket', 2)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 15 * 60,
    });
  });

  it.each([
    [[2, 321], 2, true],
    [[3, 321], 2, false],
    [[1, 0], 2, true],
  ])(
    'maps valid Redis integers to a decision',
    async (result, limit, allowed) => {
      const evalScript = jest.fn().mockResolvedValue(result);
      const redis = { client: { eval: evalScript } } as unknown as RedisService;
      const config = { rateLimitKeySecret: 'secret' } as AppConfig;
      const limiter = new RedisFixedWindowRateLimiter(redis, config);

      await expect(limiter.increment('bucket', limit)).resolves.toEqual({
        allowed,
        retryAfterSeconds: Math.max(1, result[1] ?? 0),
      });
    },
  );
});
