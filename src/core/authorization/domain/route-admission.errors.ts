import { ApplicationError } from '../../../shared/domain/application-error';

export class RouteAccessDeniedError extends ApplicationError {
  readonly code = 'ROUTE_ACCESS_DENIED';
  readonly retryable = false;

  constructor() {
    super('Access to this route is denied.');
  }
}

export class EmailVerificationRequiredError extends ApplicationError {
  readonly code = 'EMAIL_VERIFICATION_REQUIRED';
  readonly retryable = false;

  constructor() {
    super('Email verification is required.');
  }
}
