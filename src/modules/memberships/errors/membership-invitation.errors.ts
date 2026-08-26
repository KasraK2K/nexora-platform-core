import { ApplicationError } from '../../../common/errors/application-error';

/** Safe failure for a malformed, expired, consumed, or unauthorized invitation. */
export class MembershipInvitationInvalidError extends ApplicationError {
  readonly code = 'MEMBERSHIP_INVITATION_INVALID';
  readonly retryable = false;

  constructor() {
    super('The membership invitation is invalid or has expired.');
  }
}

/** Safe conflict when the requested workspace membership or invitation exists. */
export class MembershipInvitationConflictError extends ApplicationError {
  readonly code = 'MEMBERSHIP_INVITATION_CONFLICT';
  readonly retryable = false;

  constructor() {
    super('A membership or invitation already exists for this workspace.');
  }
}

/** Retryable failure used when invitation infrastructure cannot respond safely. */
export class MembershipInvitationUnavailableError extends ApplicationError {
  readonly code = 'MEMBERSHIP_INVITATION_UNAVAILABLE';
  readonly retryable = true;

  constructor() {
    super('Membership invitations are temporarily unavailable.');
  }
}
