import { ApplicationError } from '../../../shared/domain/application-error';

export class WorkspaceLifecycleInvalidError extends ApplicationError {
  readonly code = 'WORKSPACE_LIFECYCLE_INVALID';
  readonly retryable = false;

  constructor() {
    super('The workspace lifecycle request is no longer valid.');
  }
}

export class WorkspaceLifecycleUnavailableError extends ApplicationError {
  readonly code = 'WORKSPACE_LIFECYCLE_UNAVAILABLE';
  readonly retryable = true;

  constructor() {
    super('Workspace lifecycle operations are temporarily unavailable.');
  }
}
