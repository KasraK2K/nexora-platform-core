import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { OperationalTelemetry } from './application/operational-telemetry';

@Injectable()
export class HttpTelemetryMiddleware implements NestMiddleware {
  constructor(private readonly telemetry: OperationalTelemetry) {}

  use(request: Request, response: Response, next: NextFunction): void {
    response.once('finish', () => {
      this.telemetry.recordHttpRequest(request.method, response.statusCode);
    });
    next();
  }
}
