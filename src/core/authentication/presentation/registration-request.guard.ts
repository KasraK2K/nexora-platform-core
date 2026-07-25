import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppConfig } from '../../configuration/app-config';
import { RegistrationRateLimiter } from '../infrastructure/registration-rate-limiter';

@Injectable()
export class RegistrationRequestGuard implements CanActivate {
  constructor(
    private readonly config: AppConfig,
    private readonly rateLimiter: RegistrationRateLimiter,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const origin = request.header('origin');

    if (!origin || !this.config.allowedOrigins.has(origin)) {
      throw new HttpException(
        {
          code: 'ORIGIN_NOT_ALLOWED',
          message: 'Request origin is not allowed.',
          retryable: false,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const email = readNormalizedEmail(request.body);
    const decision = await this.rateLimiter.check(
      request.ip || request.socket.remoteAddress || 'unknown',
      email,
    );

    if (!decision.allowed) {
      response.setHeader('retry-after', decision.retryAfterSeconds.toString());
      throw new HttpException(
        {
          code: 'REGISTRATION_RATE_LIMITED',
          message: 'Too many registration attempts.',
          retryable: true,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}

function readNormalizedEmail(body: unknown): string | undefined {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('email' in body) ||
    typeof body.email !== 'string'
  ) {
    return undefined;
  }

  return body.email.trim().toLocaleLowerCase('en-US').slice(0, 254);
}
