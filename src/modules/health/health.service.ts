import { Injectable, type BeforeApplicationShutdown } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { ObservabilityService } from '../observability/observability.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RedisService } from '../../infrastructure/cache/redis.service';

/** Safe dependency status returned by readiness checks. */
export type ReadinessResult = Readonly<{
  ready: boolean;
  checks: Readonly<{
    postgresql: 'up' | 'down';
    redis: 'up' | 'down';
  }>;
}>;

/** Checks required infrastructure with bounded timeouts and records outcomes. */
@Injectable()
export class HealthService implements BeforeApplicationShutdown {
  private shuttingDown = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: AppConfig,
    private readonly telemetry: ObservabilityService,
  ) {}

  /** Makes all later readiness checks fail without contacting dependencies. */
  markShuttingDown(): void {
    this.shuttingDown = true;
  }

  /** Removes the process from service before connections begin closing. */
  beforeApplicationShutdown(): void {
    this.markShuttingDown();
  }

  /** Checks PostgreSQL and Redis in parallel and never exposes raw errors. */
  async readiness(): Promise<ReadinessResult> {
    if (this.shuttingDown) {
      return {
        ready: false,
        checks: { postgresql: 'down', redis: 'down' },
      };
    }
    const [postgresql, redis] = await Promise.all([
      check(() => this.prisma.ping(), this.config.dependencyHealthTimeoutMs),
      check(
        () => this.redis.client.ping(),
        this.config.dependencyHealthTimeoutMs,
      ),
    ]);
    this.telemetry.recordDependencyCheck('postgresql', postgresql);
    this.telemetry.recordDependencyCheck('redis', redis);
    return {
      ready: postgresql === 'up' && redis === 'up',
      checks: { postgresql, redis },
    };
  }
}

/** Converts success, rejection, or timeout into the readiness `up`/`down` shape. */
async function check(
  operation: () => Promise<unknown>,
  timeoutMs: number,
): Promise<'up' | 'down'> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('dependency timeout')),
          timeoutMs,
        );
        timer.unref();
      }),
    ]);
    return 'up';
  } catch {
    return 'down';
  } finally {
    if (timer) clearTimeout(timer);
  }
}
