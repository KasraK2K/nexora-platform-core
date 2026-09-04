import type { RateLimitDecision } from '../../../common/http/request-rate-limit';
import { RedisFixedWindowRateLimiter } from '../../../infrastructure/cache/redis-fixed-window-rate-limiter';
import { AuthenticationRateLimiter } from './redis-authentication-rate-limiter';

describe('AuthenticationRateLimiter', () => {
  const allowed: RateLimitDecision = { allowed: true, retryAfterSeconds: 0 };
  const increment = jest.fn<Promise<RateLimitDecision>, [string, number]>();
  const digest = jest.fn((value: string) => `h(${value})`);
  const windows = {
    increment,
    digest,
  } as unknown as RedisFixedWindowRateLimiter;
  const limiter = new AuthenticationRateLimiter(windows);

  beforeEach(() => {
    jest.clearAllMocks();
    increment.mockResolvedValue(allowed);
  });

  it.each([
    ['registration', 'checkRegistration', 10, 5],
    ['login', 'checkLogin', 20, 10],
    ['email-verification-request', 'checkEmailVerificationRequest', 20, 5],
    ['password-reset-request', 'checkPasswordResetRequest', 20, 5],
  ] as const)(
    'uses exact %s IP and email buckets in order',
    async (scope, method, ipLimit, emailLimit) => {
      await limiter[method]('203.0.113.7', 'person@example.com');
      expect(increment.mock.calls).toEqual([
        [`auth:${scope}:ip:h(203.0.113.7)`, ipLimit],
        [`auth:${scope}:email:h(person@example.com)`, emailLimit],
      ]);
    },
  );

  it.each([
    ['email-verification-confirmation', 'checkEmailVerificationConfirmation'],
    ['password-reset-confirmation', 'checkPasswordResetConfirmation'],
  ] as const)('uses the exact %s IP-only bucket', async (scope, method) => {
    await limiter[method]('203.0.113.7');
    expect(increment.mock.calls).toEqual([
      [`auth:${scope}:ip:h(203.0.113.7)`, 30],
    ]);
  });

  it.each([
    ['password-change', 'checkPasswordChange', 10, 5],
    ['workspace-switch', 'checkWorkspaceSwitch', 30, 10],
  ] as const)(
    'uses exact %s IP and session buckets in order',
    async (scope, method, ipLimit, sessionLimit) => {
      await limiter[method]('203.0.113.7', 'opaque-session');
      expect(increment.mock.calls).toEqual([
        [`auth:${scope}:ip:h(203.0.113.7)`, ipLimit],
        [`auth:${scope}:session:h(opaque-session)`, sessionLimit],
      ]);
    },
  );

  it('stops after a denied IP decision', async () => {
    const denied = { allowed: false, retryAfterSeconds: 17 };
    increment.mockResolvedValueOnce(denied);
    await expect(
      limiter.checkLogin('203.0.113.7', 'person@example.com'),
    ).resolves.toBe(denied);
    expect(increment).toHaveBeenCalledTimes(1);
  });
});
