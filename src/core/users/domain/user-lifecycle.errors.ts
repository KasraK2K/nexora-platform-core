import { ApplicationError } from '../../../shared/domain/application-error';

export class UserLifecycleInvalidError extends ApplicationError {
  readonly code = 'USER_LIFECYCLE_INVALID';
  readonly retryable = false;

  constructor() {
    super('The user lifecycle request is no longer valid.');
  }
}

export class UserLifecycleUnavailableError extends ApplicationError {
  readonly code = 'USER_LIFECYCLE_UNAVAILABLE';
  readonly retryable = true;

  constructor() {
    super('User lifecycle operations are temporarily unavailable.');
  }
}
