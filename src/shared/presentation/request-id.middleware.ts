import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { v7 as uuidv7 } from 'uuid';
import { runWithRequestContext } from '../application/request-context';

export type RequestWithId = Request & {
  requestId: string;
  correlationId: string;
  traceparent?: string;
};

const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;
const SAFE_TRACEPARENT = /^00-[a-f0-9]{32}-[a-f0-9]{16}-[a-f0-9]{2}$/;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const supplied = request.header('x-request-id');
    const requestId =
      supplied && SAFE_REQUEST_ID.test(supplied) ? supplied : uuidv7();

    const suppliedCorrelation = request.header('x-correlation-id');
    const correlationId =
      suppliedCorrelation && SAFE_REQUEST_ID.test(suppliedCorrelation)
        ? suppliedCorrelation
        : requestId;
    const suppliedTraceparent = request.header('traceparent')?.toLowerCase();
    const traceparent =
      suppliedTraceparent && SAFE_TRACEPARENT.test(suppliedTraceparent)
        ? suppliedTraceparent
        : undefined;
    const contextualRequest = request as RequestWithId;
    contextualRequest.requestId = requestId;
    contextualRequest.correlationId = correlationId;
    contextualRequest.traceparent = traceparent;
    response.setHeader('x-request-id', requestId);
    response.setHeader('x-correlation-id', correlationId);
    if (traceparent) response.setHeader('traceparent', traceparent);
    runWithRequestContext({ requestId, correlationId, traceparent }, next);
  }
}
