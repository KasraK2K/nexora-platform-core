import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PublicRoute } from '../authorization/presentation/route-admission';
import { DependencyHealthService } from './infrastructure/dependency-health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: DependencyHealthService) {}

  @Get('live')
  @PublicRoute()
  liveness(): Readonly<{ status: 'live' }> {
    return { status: 'live' };
  }

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
