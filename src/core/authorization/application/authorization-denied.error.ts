import { ApplicationError } from '../../../shared/domain/application-error';

export class AuthorizationDeniedError extends ApplicationError {
  readonly code = 'AUTHORIZATION_DENIED';
  readonly retryable = false;

  constructor() {
    super('You are not authorized to perform this action.');
  }
}
