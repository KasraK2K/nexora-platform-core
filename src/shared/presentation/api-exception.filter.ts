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

type SafeMembershipRole = 'OWNER' | 'ADMIN' | 'MEMBER';

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
 * Known application messages and already safe-shaped HTTP errors remain a
 * producer responsibility; this filter does not scan arbitrary text for PII.
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

/** Maps stable application error codes to their public HTTP status. */
function applicationErrorStatus(code: string): number {
  switch (code) {
    case 'REGISTRATION_INVALID':
    case 'EMAIL_VERIFICATION_INVALID':
    case 'PASSWORD_RESET_INVALID':
    case 'PASSWORD_RESET_INVALID_PASSWORD':
    case 'PASSWORD_CHANGE_INVALID_PASSWORD':
    case 'MEMBERSHIP_PAGE_CURSOR_INVALID':
    case 'MEMBERSHIP_OWNERSHIP_TRANSFER_INVALID':
      return HttpStatus.BAD_REQUEST;
    case 'EMAIL_ALREADY_REGISTERED':
    case 'WORKSPACE_SELECTION_REQUIRED':
    case 'MEMBERSHIP_OWNERSHIP_PROTECTED':
    case 'MEMBERSHIP_LAST_WORKSPACE_PROTECTED':
      return HttpStatus.CONFLICT;
    case 'AUTHENTICATION_REQUIRED':
    case 'AUTHENTICATION_INVALID':
    case 'USER_LIFECYCLE_INVALID':
    case 'WORKSPACE_LIFECYCLE_INVALID':
    case 'PASSWORD_CHANGE_INVALID_CURRENT_PASSWORD':
      return HttpStatus.UNAUTHORIZED;
    case 'ROUTE_ACCESS_DENIED':
    case 'EMAIL_VERIFICATION_REQUIRED':
    case 'WORKSPACE_ACCESS_DENIED':
    case 'AUTHORIZATION_DENIED':
      return HttpStatus.FORBIDDEN;
    case 'MEMBERSHIP_INVITATION_INVALID':
      return HttpStatus.BAD_REQUEST;
    case 'MEMBERSHIP_INVITATION_CONFLICT':
      return HttpStatus.CONFLICT;
    case 'REGISTRATION_UNAVAILABLE':
    case 'AUTHENTICATION_UNAVAILABLE':
    case 'EMAIL_VERIFICATION_UNAVAILABLE':
    case 'PASSWORD_RESET_UNAVAILABLE':
    case 'PASSWORD_CHANGE_UNAVAILABLE':
    case 'WORKSPACE_SWITCH_UNAVAILABLE':
    case 'MEMBERSHIP_INVITATION_UNAVAILABLE':
    case 'MEMBERSHIP_ADMINISTRATION_UNAVAILABLE':
    case 'USER_LIFECYCLE_UNAVAILABLE':
    case 'WORKSPACE_LIFECYCLE_UNAVAILABLE':
      return HttpStatus.SERVICE_UNAVAILABLE;
    default:
      return HttpStatus.INTERNAL_SERVER_ERROR;
  }
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
        organization: { id: string; name: string };
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
    organization: { id: string; name: string };
    workspace: { id: string; name: string };
    membership: { role: SafeMembershipRole };
  }> = [];
  for (const option of options) {
    if (!isUnknownRecord(option)) return undefined;
    const organization = readIdAndName(option, 'organization');
    const workspace = readIdAndName(option, 'workspace');
    const membership: unknown = option.membership;
    if (
      !organization ||
      !workspace ||
      !isUnknownRecord(membership) ||
      !isSafeMembershipRole(membership.role)
    ) {
      return undefined;
    }
    availableWorkspaces.push({
      organization,
      workspace,
      membership: { role: membership.role },
    });
  }
  return { availableWorkspaces };
}

/** Reads a safe `{id, name}` pair from a known nested response field. */
function readIdAndName(
  value: Record<string, unknown>,
  key: 'organization' | 'workspace',
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

/** Allows only the three membership roles that may be returned publicly. */
function isSafeMembershipRole(value: unknown): value is SafeMembershipRole {
  return value === 'OWNER' || value === 'ADMIN' || value === 'MEMBER';
}
