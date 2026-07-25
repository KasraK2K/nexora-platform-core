import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { v7 as uuidv7 } from 'uuid';

export type RequestWithId = Request & { requestId: string };

const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const supplied = request.header('x-request-id');
    const requestId =
      supplied && SAFE_REQUEST_ID.test(supplied) ? supplied : uuidv7();

    (request as RequestWithId).requestId = requestId;
    response.setHeader('x-request-id', requestId);
    next();
  }
}
