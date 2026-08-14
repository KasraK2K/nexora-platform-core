import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PublicRoute } from '../authorization/presentation/route-admission';
import { DependencyHealthService } from './infrastructure/dependency-health.service';

/** Exposes minimal public probes for process and dependency health. */
@Controller('health')
export class HealthController {
  constructor(private readonly health: DependencyHealthService) {}

  /** Reports that the Node process is running without checking dependencies. */
  @Get('live')
  @PublicRoute()
  liveness(): Readonly<{ status: 'live' }> {
    return { status: 'live' };
  }

  /**
   * Reports PostgreSQL and Redis readiness and returns HTTP 503 when either is
   * unavailable or graceful shutdown has started.
   */
  @Get('ready')
  @PublicRoute()
  async readiness(
    @Res({ passthrough: true }) response: Response,
  ): Promise<unknown> {
    const result = await this.health.readiness();
    response.status(
      result.ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
    );
    return {
      status: result.ready ? 'ready' : 'not_ready',
      checks: result.checks,
    };
  }
}
