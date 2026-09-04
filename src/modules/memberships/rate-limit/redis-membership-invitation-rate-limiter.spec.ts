import type { RateLimitDecision } from '../../../common/http/request-rate-limit';
import { RedisFixedWindowRateLimiter } from '../../../infrastructure/cache/redis-fixed-window-rate-limiter';
import { MembershipInvitationRateLimiter } from './redis-membership-invitation-rate-limiter';

describe('MembershipInvitationRateLimiter', () => {
  const allowed: RateLimitDecision = { allowed: true, retryAfterSeconds: 0 };
  const increment = jest.fn<Promise<RateLimitDecision>, [string, number]>();
  const digest = jest.fn((value: string) => `h(${value})`);
  const windows = {
    increment,
    digest,
  } as unknown as RedisFixedWindowRateLimiter;
  const limiter = new MembershipInvitationRateLimiter(windows);

  beforeEach(() => {
    jest.clearAllMocks();
    increment.mockResolvedValue(allowed);
  });

  it('uses exact create buckets and limits in order', async () => {
    await limiter.checkCreate({
      clientIp: '203.0.113.7',
      actorUserId: 'actor',
      workspaceId: 'workspace',
      normalizedEmail: 'person@example.com',
    });
    expect(increment.mock.calls).toEqual([
      ['membership-invitation:create:ip:h(203.0.113.7)', 50],
      ['membership-invitation:create:actor-workspace:h(actor\0workspace)', 20],
      [
        'membership-invitation:create:target:h(workspace\0person@example.com)',
        5,
      ],
    ]);
  });

  it('uses exact acceptance buckets and limits in order', async () => {
    await limiter.checkAccept({
      clientIp: '203.0.113.7',
      sessionId: 'session',
    });
    expect(increment.mock.calls).toEqual([
      ['membership-invitation:accept:ip:h(203.0.113.7)', 30],
      ['membership-invitation:accept:session:h(session)', 20],
    ]);
  });

  it('stops at the first denied bucket', async () => {
    const denied = { allowed: false, retryAfterSeconds: 9 };
    increment.mockResolvedValueOnce(allowed).mockResolvedValueOnce(denied);
    await expect(
      limiter.checkCreate({
        clientIp: '203.0.113.7',
        actorUserId: 'actor',
        workspaceId: 'workspace',
        normalizedEmail: 'person@example.com',
      }),
    ).resolves.toBe(denied);
    expect(increment).toHaveBeenCalledTimes(2);
  });
});
