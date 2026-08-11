import { assertSafeLocalMutationTargets } from './local-mutation-target.policy';

const developmentEnvironment = {
  NODE_ENV: 'development',
  DATABASE_URL:
    'postgresql://nexora:nexora_local@localhost:55432/nexora?schema=public',
  REDIS_URL: 'redis://localhost:56379',
};

describe('local mutation target policy', () => {
  it('accepts only the committed local development target', () => {
    expect(() =>
      assertSafeLocalMutationTargets(
        developmentEnvironment,
        'development-schema',
      ),
    ).not.toThrow();
  });

  it.each([
    [{ ...developmentEnvironment, NODE_ENV: 'production' }, 'environment'],
    [
      {
        ...developmentEnvironment,
        DATABASE_URL:
          'postgresql://nexora:nexora_local@database.example.com:55432/nexora',
      },
      'target',
    ],
    [
      {
        ...developmentEnvironment,
        DATABASE_URL:
          'postgresql://nexora:nexora_local@localhost:55432/customer_data',
      },
      'target',
    ],
  ])('rejects an unsafe database target', (environment, expectedMessage) => {
    expect(() =>
      assertSafeLocalMutationTargets(environment, 'development-schema'),
    ).toThrow(expectedMessage);
  });

  it('validates the isolated Redis target before E2E cleanup', () => {
    expect(() =>
      assertSafeLocalMutationTargets(
        {
          NODE_ENV: 'test',
          DATABASE_URL:
            'postgresql://nexora_test:nexora_test@localhost:55433/nexora_test',
          REDIS_URL: 'redis://cache.example.com:56380',
        },
        'test-schema',
      ),
    ).toThrow('Redis mutation target');
  });
});
