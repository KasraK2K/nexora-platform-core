import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApplicationError,
  type ApplicationErrorCode,
} from '../errors/application-error';
import {
  ApiExceptionFilter,
  APPLICATION_ERROR_HTTP_STATUS,
} from './api-exception.filter';
import type { RequestWithId } from './request-id.middleware';

class TestApplicationError extends ApplicationError {
  override readonly retryable = false;

  constructor(override readonly code: ApplicationErrorCode) {
    super('Safe application failure.');
  }
}

class WorkspaceSelectionTestError extends ApplicationError {
  override readonly code = 'WORKSPACE_SELECTION_REQUIRED';
  override readonly retryable = false;
  readonly details: unknown;

  constructor(details: unknown) {
    super('Select a workspace to continue.');
    this.details = details;
  }
}

describe(ApiExceptionFilter.name, () => {
  let loggerError: jest.SpyInstance;

  beforeEach(() => {
    loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    loggerError.mockRestore();
  });

  it.each(
    Object.entries(APPLICATION_ERROR_HTTP_STATUS) as Array<
      [ApplicationErrorCode, HttpStatus]
    >,
  )('maps %s to HTTP %s', (code, expectedStatus) => {
    const result = capture(new TestApplicationError(code));

    expect(result.status).toBe(expectedStatus);
    expect(result.body).toEqual({
      error: {
        code,
        message: 'Safe application failure.',
        retryable: false,
        requestId: 'request-id',
      },
    });
  });

  it('reconstructs validation details and strips hostile fields', () => {
    const result = capture(
      new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed.',
        retryable: false,
        secret: 'must-not-leak',
        sql: 'select sensitive',
        stack: 'private stack',
        details: [
          {
            path: 'email',
            code: 'invalid_format',
            message: 'private validator detail',
            token: 'must-not-leak',
          },
        ],
      }),
    );

    expect(result).toEqual({
      status: HttpStatus.BAD_REQUEST,
      body: {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Request validation failed.',
          retryable: false,
          details: [{ path: 'email', code: 'invalid_format' }],
          requestId: 'request-id',
        },
      },
    });
  });

  it('omits malformed validation details', () => {
    const result = capture(
      new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed.',
        retryable: false,
        details: [{ path: 'email', code: 42 }],
      }),
    );

    expect(result.body).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed.',
        retryable: false,
        requestId: 'request-id',
      },
    });
  });

  it('reconstructs safe HTTP errors without arbitrary details', () => {
    const result = capture(
      new HttpException(
        {
          code: 'DEPENDENCY_FAILED',
          message: 'A dependency is unavailable.',
          retryable: true,
          details: { secret: 'must-not-leak' },
          token: 'must-not-leak',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      ),
    );

    expect(result.body).toEqual({
      error: {
        code: 'DEPENDENCY_FAILED',
        message: 'A dependency is unavailable.',
        retryable: true,
        requestId: 'request-id',
      },
    });
  });

  it('preserves sanitized workspace-selection details only', () => {
    const result = capture(
      new WorkspaceSelectionTestError({
        availableWorkspaces: [
          {
            workspace: {
              id: 'workspace-id',
              name: 'Workspace',
              secret: 'must-not-leak',
            },
            membership: { role: 'OWNER', token: 'must-not-leak' },
            sql: 'select sensitive',
          },
        ],
        stack: 'private stack',
      }),
    );

    expect(result.body).toEqual({
      error: {
        code: 'WORKSPACE_SELECTION_REQUIRED',
        message: 'Select a workspace to continue.',
        retryable: false,
        details: {
          availableWorkspaces: [
            {
              workspace: { id: 'workspace-id', name: 'Workspace' },
              membership: { role: 'OWNER' },
            },
          ],
        },
        requestId: 'request-id',
      },
    });
  });
});

function capture(exception: unknown): { status: number; body: unknown } {
  let capturedStatus: number | undefined;
  let capturedBody: unknown;
  const response = {
    status(status: number) {
      capturedStatus = status;
      return this;
    },
    json(body: unknown) {
      capturedBody = body;
      return this;
    },
  } as unknown as Response;
  const request = { requestId: 'request-id' } as RequestWithId;
  const host = {
    switchToHttp() {
      return {
        getRequest: () => request as Request,
        getResponse: () => response,
      };
    },
  } as ArgumentsHost;

  new ApiExceptionFilter().catch(exception, host);

  if (capturedStatus === undefined) {
    throw new Error('Expected the exception filter to set an HTTP status.');
  }
  return { status: capturedStatus, body: capturedBody };
}
