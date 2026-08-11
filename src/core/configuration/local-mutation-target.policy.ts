export type LocalMutationPurpose =
  'development-schema' | 'test-schema' | 'seed';

type MutationEnvironment = Readonly<{
  NODE_ENV?: string;
  DATABASE_URL?: string;
  REDIS_URL?: string;
}>;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function assertSafeLocalMutationTargets(
  environment: MutationEnvironment,
  purpose: LocalMutationPurpose,
): void {
  const expectedEnvironment =
    purpose === 'seed' ? environment.NODE_ENV : purpose.split('-')[0];
  if (expectedEnvironment !== 'development' && expectedEnvironment !== 'test') {
    throw new Error('Local database mutation requires development or test.');
  }
  if (environment.NODE_ENV !== expectedEnvironment) {
    throw new Error('Local database mutation environment does not match.');
  }

  const expected =
    expectedEnvironment === 'test'
      ? {
          databaseName: 'nexora_test',
          databaseUser: 'nexora_test',
          databasePort: '55433',
          redisPort: '56380',
        }
      : {
          databaseName: 'nexora',
          databaseUser: 'nexora',
          databasePort: '55432',
          redisPort: '56379',
        };
  const database = parseUrl(environment.DATABASE_URL, 'Database');
  if (
    !['postgres:', 'postgresql:'].includes(database.protocol) ||
    !LOOPBACK_HOSTS.has(database.hostname) ||
    database.port !== expected.databasePort ||
    decodeURIComponent(database.username) !== expected.databaseUser ||
    decodeURIComponent(database.pathname.replace(/^\//, '')) !==
      expected.databaseName
  ) {
    throw new Error(
      'Database mutation target is not the approved local target.',
    );
  }

  if (purpose !== 'test-schema') return;
  const redis = parseUrl(environment.REDIS_URL, 'Redis');
  if (
    redis.protocol !== 'redis:' ||
    !LOOPBACK_HOSTS.has(redis.hostname) ||
    redis.port !== expected.redisPort
  ) {
    throw new Error('Redis mutation target is not the approved local target.');
  }
}

function parseUrl(value: string | undefined, label: string): URL {
  if (!value) throw new Error(`${label} target is required.`);
  try {
    return new URL(value);
  } catch {
    throw new Error(`${label} target is invalid.`);
  }
}
