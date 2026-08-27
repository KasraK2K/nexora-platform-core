import { ApplicationError } from '../../common/errors/application-error';

/** Stable denial for a known route whose actor lacks the required capability. */
export class AuthorizationDeniedError extends ApplicationError {
  readonly code = 'AUTHORIZATION_DENIED';
  readonly retryable = false;

  constructor() {
    super('You are not authorized to perform this action.');
  }
}
