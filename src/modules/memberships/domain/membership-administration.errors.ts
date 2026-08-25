import { ApplicationError } from '../../../common/domain/application-error';

/** Safe failure for a cursor that is not active in the trusted workspace. */
export class MembershipPageCursorInvalidError extends ApplicationError {
  readonly code = 'MEMBERSHIP_PAGE_CURSOR_INVALID';
  readonly retryable = false;

  constructor() {
    super('The membership page cursor is invalid.');
  }
}

/** Prevents implicit removal, role change, or self-leave by a workspace owner. */
export class MembershipOwnershipProtectedError extends ApplicationError {
  readonly code = 'MEMBERSHIP_OWNERSHIP_PROTECTED';
  readonly retryable = false;

  constructor() {
    super('Workspace ownership must be transferred explicitly.');
  }
}

/** Prevents self-service leave from removing a user's final active workspace. */
export class MembershipLastWorkspaceProtectedError extends ApplicationError {
  readonly code = 'MEMBERSHIP_LAST_WORKSPACE_PROTECTED';
  readonly retryable = false;

  constructor() {
    super('The final active workspace membership cannot be left.');
  }
}

/** Generic step-up failure that does not reveal which transfer proof was invalid. */
export class MembershipOwnershipTransferInvalidError extends ApplicationError {
  readonly code = 'MEMBERSHIP_OWNERSHIP_TRANSFER_INVALID';
  readonly retryable = false;

  constructor() {
    super('The workspace ownership transfer could not be confirmed.');
  }
}

/** Retryable safe failure for unexpected membership administration faults. */
export class MembershipAdministrationUnavailableError extends ApplicationError {
  readonly code = 'MEMBERSHIP_ADMINISTRATION_UNAVAILABLE';
  readonly retryable = true;

  constructor() {
    super('Membership administration is temporarily unavailable.');
  }
}
