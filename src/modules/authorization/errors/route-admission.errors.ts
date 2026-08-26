import { ApplicationError } from '../../../common/errors/application-error';

/** Stable fail-closed response for missing, malformed, or failed admission. */
export class RouteAccessDeniedError extends ApplicationError {
  readonly code = 'ROUTE_ACCESS_DENIED';
  readonly retryable = false;

  constructor() {
    super('Access to this route is denied.');
  }
}

/** Stable denial for a valid session whose user still requires verification. */
export class EmailVerificationRequiredError extends ApplicationError {
  readonly code = 'EMAIL_VERIFICATION_REQUIRED';
  readonly retryable = false;

  constructor() {
    super('Email verification is required.');
  }
}
