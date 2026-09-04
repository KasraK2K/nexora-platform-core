import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ApplicationError,
  type ApplicationErrorCode,
} from '../errors/application-error';
import { RequestWithId } from './request-id.middleware';

type SafeMembershipRole = 'OWNER' | 'MEMBER';

type SafeErrorBody = {
  code: string;
  message: string;
  retryable: boolean;
  details?: unknown;
};

/**
 * Converts thrown values into the API's stable error envelope and prevents
 * framework, database, stack, or unexpected error details from leaking.
 *
 * Known application messages remain a producer responsibility. HTTP error
 * bodies are reconstructed at this final boundary so unapproved fields cannot
 * leak even when a producer accidentally includes them.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  /** Sends one safe JSON error response and logs only a code for server errors. */
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

  /** Maps known application and HTTP errors; everything else becomes generic. */
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
          ...readApplicationErrorDetails(exception),
        },
      };
    }

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (isSafeErrorBody(response)) {
        return {
          status: exception.getStatus(),
          body: {
            code: response.code,
            message: response.message,
            retryable: response.retryable,
            ...readHttpErrorDetails(response),
          },
        };
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

/** Checks whether an HTTP exception already contains the approved safe shape. */
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

/** Canonical exhaustive transport status for each stable application error. */
export const APPLICATION_ERROR_HTTP_STATUS = {
  REGISTRATION_INVALID: HttpStatus.BAD_REQUEST,
  EMAIL_ALREADY_REGISTERED: HttpStatus.CONFLICT,
  REGISTRATION_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  AUTHENTICATION_REQUIRED: HttpStatus.UNAUTHORIZED,
  AUTHENTICATION_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  AUTHENTICATION_INVALID: HttpStatus.UNAUTHORIZED,
  WORKSPACE_SELECTION_REQUIRED: HttpStatus.CONFLICT,
  WORKSPACE_ACCESS_DENIED: HttpStatus.FORBIDDEN,
  WORKSPACE_SWITCH_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  EMAIL_VERIFICATION_INVALID: HttpStatus.BAD_REQUEST,
  EMAIL_VERIFICATION_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  PASSWORD_RESET_INVALID: HttpStatus.BAD_REQUEST,
  PASSWORD_RESET_INVALID_PASSWORD: HttpStatus.BAD_REQUEST,
  PASSWORD_RESET_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  PASSWORD_CHANGE_INVALID_CURRENT_PASSWORD: HttpStatus.UNAUTHORIZED,
  PASSWORD_CHANGE_INVALID_PASSWORD: HttpStatus.BAD_REQUEST,
  PASSWORD_CHANGE_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  ROUTE_ACCESS_DENIED: HttpStatus.FORBIDDEN,
  EMAIL_VERIFICATION_REQUIRED: HttpStatus.FORBIDDEN,
  AUTHORIZATION_DENIED: HttpStatus.FORBIDDEN,
  MEMBERSHIP_INVITATION_INVALID: HttpStatus.BAD_REQUEST,
  MEMBERSHIP_INVITATION_CONFLICT: HttpStatus.CONFLICT,
  MEMBERSHIP_INVITATION_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  MEMBERSHIP_PAGE_CURSOR_INVALID: HttpStatus.BAD_REQUEST,
  MEMBERSHIP_OWNERSHIP_PROTECTED: HttpStatus.CONFLICT,
  MEMBERSHIPS_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  USER_LIFECYCLE_INVALID: HttpStatus.UNAUTHORIZED,
  USER_LIFECYCLE_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  WORKSPACE_LIFECYCLE_INVALID: HttpStatus.UNAUTHORIZED,
  WORKSPACE_LIFECYCLE_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
} as const satisfies Readonly<Record<ApplicationErrorCode, HttpStatus>>;

/** Maps stable application error codes to their public HTTP status. */
function applicationErrorStatus(code: ApplicationErrorCode): HttpStatus {
  return APPLICATION_ERROR_HTTP_STATUS[code];
}

/** Allows only the bounded validation-detail contract for HTTP errors. */
function readHttpErrorDetails(
  body: SafeErrorBody,
): Pick<SafeErrorBody, 'details'> | Record<string, never> {
  if (body.code !== 'VALIDATION_FAILED') return {};
  const details = serializeValidationDetails(body.details);
  return details ? { details } : {};
}

/** Reconstructs validation issues from string paths and machine codes only. */
function serializeValidationDetails(
  value: unknown,
): Array<{ path: string; code: string }> | undefined {
  if (!Array.isArray(value) || value.length > 100) return undefined;

  const details: Array<{ path: string; code: string }> = [];
  for (const issue of value) {
    if (
      !isUnknownRecord(issue) ||
      typeof issue.path !== 'string' ||
      typeof issue.code !== 'string'
    ) {
      return undefined;
    }
    details.push({ path: issue.path, code: issue.code });
  }
  return details;
}

/**
 * Allows details only for workspace selection, the one application error whose
 * bounded choices are part of its public response contract.
 */
function readApplicationErrorDetails(
  error: ApplicationError,
): Pick<SafeErrorBody, 'details'> | Record<string, never> {
  if (error.code !== 'WORKSPACE_SELECTION_REQUIRED' || !('details' in error)) {
    return {};
  }
  const details = serializeWorkspaceSelectionDetails(error.details);
  return details ? { details } : {};
}

/**
 * Revalidates workspace-selection details at the final response boundary.
 * Any unexpected field shape or more than 100 choices removes all details.
 */
function serializeWorkspaceSelectionDetails(value: unknown):
  | {
      availableWorkspaces: Array<{
        workspace: { id: string; name: string };
        membership: { role: SafeMembershipRole };
      }>;
    }
  | undefined {
  if (!isUnknownRecord(value)) {
    return undefined;
  }
  const candidateOptions: unknown = value.availableWorkspaces;
  if (!Array.isArray(candidateOptions)) return undefined;
  const options: unknown[] = candidateOptions;
  if (options.length > 100) return undefined;

  const availableWorkspaces: Array<{
    workspace: { id: string; name: string };
    membership: { role: SafeMembershipRole };
  }> = [];
  for (const option of options) {
    if (!isUnknownRecord(option)) return undefined;
    const workspace = readIdAndName(option, 'workspace');
    const membership: unknown = option.membership;
    if (
      !workspace ||
      !isUnknownRecord(membership) ||
      !isSafeMembershipRole(membership.role)
    ) {
      return undefined;
    }
    availableWorkspaces.push({
      workspace,
      membership: { role: membership.role },
    });
  }
  return { availableWorkspaces };
}

/** Reads a safe `{id, name}` pair from a known nested response field. */
function readIdAndName(
  value: Record<string, unknown>,
  key: 'workspace',
): { id: string; name: string } | undefined {
  const nested: unknown = value[key];
  if (
    isUnknownRecord(nested) &&
    typeof nested.id === 'string' &&
    typeof nested.name === 'string'
  ) {
    return { id: nested.id, name: nested.name };
  }
  return undefined;
}

/** Narrows an unknown object before reading response fields from it. */
function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Allows only roles derived from permanent workspace ownership. */
function isSafeMembershipRole(value: unknown): value is SafeMembershipRole {
  return value === 'OWNER' || value === 'MEMBER';
}
