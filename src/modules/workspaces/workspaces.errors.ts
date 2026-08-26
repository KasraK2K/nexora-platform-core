import { ApplicationError } from '../../common/errors/application-error';

/** Stable failure for stale, revoked, or missing workspace lifecycle state. */
export class WorkspaceLifecycleInvalidError extends ApplicationError {
  readonly code = 'WORKSPACE_LIFECYCLE_INVALID';
  readonly retryable = false;

  constructor() {
    super('The workspace lifecycle request is no longer valid.');
  }
}

/** Retryable safe failure for workspace persistence or transaction problems. */
export class WorkspaceLifecycleUnavailableError extends ApplicationError {
  readonly code = 'WORKSPACE_LIFECYCLE_UNAVAILABLE';
  readonly retryable = true;

  constructor() {
    super('Workspace lifecycle operations are temporarily unavailable.');
  }
}
