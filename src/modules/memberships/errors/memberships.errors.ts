import { ApplicationError } from '../../../common/errors/application-error';

/** Safe failure for a cursor that is not active in the trusted workspace. */
export class MembershipPageCursorInvalidError extends ApplicationError {
  readonly code = 'MEMBERSHIP_PAGE_CURSOR_INVALID';
  readonly retryable = false;

  constructor() {
    super('The membership page cursor is invalid.');
  }
}

/** Prevents removal or self-leave by a permanent workspace owner. */
export class MembershipOwnershipProtectedError extends ApplicationError {
  readonly code = 'MEMBERSHIP_OWNERSHIP_PROTECTED';
  readonly retryable = false;

  constructor() {
    super('The permanent workspace owner cannot leave or be removed.');
  }
}

/** Retryable safe failure for unexpected membership faults. */
export class MembershipsUnavailableError extends ApplicationError {
  readonly code = 'MEMBERSHIPS_UNAVAILABLE';
  readonly retryable = true;

  constructor() {
    super('Memberships are temporarily unavailable.');
  }
}
