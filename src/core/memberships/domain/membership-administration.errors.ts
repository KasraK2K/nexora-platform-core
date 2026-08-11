import { ApplicationError } from '../../../shared/domain/application-error';

export class MembershipPageCursorInvalidError extends ApplicationError {
  readonly code = 'MEMBERSHIP_PAGE_CURSOR_INVALID';
  readonly retryable = false;

  constructor() {
    super('The membership page cursor is invalid.');
  }
}

export class MembershipOwnershipProtectedError extends ApplicationError {
  readonly code = 'MEMBERSHIP_OWNERSHIP_PROTECTED';
  readonly retryable = false;

  constructor() {
    super('Workspace ownership must be transferred explicitly.');
  }
}

export class MembershipOwnershipTransferInvalidError extends ApplicationError {
  readonly code = 'MEMBERSHIP_OWNERSHIP_TRANSFER_INVALID';
  readonly retryable = false;

  constructor() {
    super('The workspace ownership transfer could not be confirmed.');
  }
}

export class MembershipAdministrationUnavailableError extends ApplicationError {
  readonly code = 'MEMBERSHIP_ADMINISTRATION_UNAVAILABLE';
  readonly retryable = true;

  constructor() {
    super('Membership administration is temporarily unavailable.');
  }
}
