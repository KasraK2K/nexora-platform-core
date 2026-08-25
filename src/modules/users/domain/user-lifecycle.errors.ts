import { ApplicationError } from '../../../common/domain/application-error';

/** Stable failure for a stale, revoked, missing, or inactive self-update. */
export class UserLifecycleInvalidError extends ApplicationError {
  readonly code = 'USER_LIFECYCLE_INVALID';
  readonly retryable = false;

  constructor() {
    super('The user lifecycle request is no longer valid.');
  }
}

/** Retryable safe failure for profile persistence or transaction problems. */
export class UserLifecycleUnavailableError extends ApplicationError {
  readonly code = 'USER_LIFECYCLE_UNAVAILABLE';
  readonly retryable = true;

  constructor() {
    super('User lifecycle operations are temporarily unavailable.');
  }
}
