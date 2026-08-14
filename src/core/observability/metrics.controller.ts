import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Req,
  Res,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { PublicRoute } from '../authorization/presentation/route-admission';
import { AppConfig } from '../configuration/app-config';
import { OperationalTelemetry } from './application/operational-telemetry';

/** Serves protected OpenMetrics output when metrics are explicitly enabled. */
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly config: AppConfig,
    private readonly telemetry: OperationalTelemetry,
  ) {}

  /**
   * Returns metrics only for the configured bearer token. Disabled or invalid
   * access looks like a missing endpoint so deployment details are not exposed.
   */
  @Get()
  @PublicRoute()
  getMetrics(@Req() request: Request, @Res() response: Response): void {
    const authorization = request.header('authorization');
    const supplied = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : '';
    if (
      !this.config.metricsEnabled ||
      !safeEqual(supplied, this.config.metricsBearerToken)
    ) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
    response
      .type('application/openmetrics-text; version=1.0.0; charset=utf-8')
      .send(this.telemetry.renderOpenMetrics());
  }
}

/** Compares equal-length secret text without content-dependent timing. */
function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
