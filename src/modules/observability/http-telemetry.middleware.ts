import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ObservabilityService } from './observability.service';

/** Records one low-cardinality counter after each HTTP response finishes. */
@Injectable()
export class HttpTelemetryMiddleware implements NestMiddleware {
  constructor(private readonly telemetry: ObservabilityService) {}

  /** Registers completion telemetry without delaying the request pipeline. */
  use(request: Request, response: Response, next: NextFunction): void {
    response.once('finish', () => {
      this.telemetry.recordHttpRequest(request.method, response.statusCode);
    });
    next();
  }
}
