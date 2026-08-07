import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApplicationError } from '../domain/application-error';
import { RequestWithId } from './request-id.middleware';

type SafeErrorBody = {
  code: string;
  message: string;
  retryable: boolean;
  details?: unknown;
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>() as RequestWithId;
    const response = context.getResponse<Response>();
    const mapped = this.mapException(exception);

    if (mapped.status >= 500) {
      this.logger.error(
        JSON.stringify({
          event: 'http.request_failed',
          code: mapped.body.code,
          requestId: request.requestId,
        }),
      );
    }

    response.status(mapped.status).json({
      error: {
        ...mapped.body,
        requestId: request.requestId,
      },
    });
  }

  private mapException(exception: unknown): {
    status: number;
    body: SafeErrorBody;
  } {
    if (exception instanceof ApplicationError) {
      return {
        status: applicationErrorStatus(exception.code),
        body: {
          code: exception.code,
          message: exception.message,
          retryable: exception.retryable,
        },
      };
    }

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (isSafeErrorBody(response)) {
        return { status: exception.getStatus(), body: response };
      }

      return {
        status: exception.getStatus(),
        body: {
          code: 'REQUEST_FAILED',
          message: 'The request could not be completed.',
          retryable: false,
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: 'INTERNAL_ERROR',
        message: 'The request could not be completed.',
        retryable: true,
      },
    };
  }
}

function isSafeErrorBody(value: unknown): value is SafeErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof value.code === 'string' &&
    'message' in value &&
    typeof value.message === 'string' &&
    'retryable' in value &&
    typeof value.retryable === 'boolean'
  );
}

function applicationErrorStatus(code: string): number {
  switch (code) {
    case 'REGISTRATION_INVALID':
      return HttpStatus.BAD_REQUEST;
    case 'EMAIL_ALREADY_REGISTERED':
      return HttpStatus.CONFLICT;
    case 'AUTHENTICATION_REQUIRED':
    case 'AUTHENTICATION_INVALID':
      return HttpStatus.UNAUTHORIZED;
    case 'REGISTRATION_UNAVAILABLE':
    case 'AUTHENTICATION_UNAVAILABLE':
      return HttpStatus.SERVICE_UNAVAILABLE;
    default:
      return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
