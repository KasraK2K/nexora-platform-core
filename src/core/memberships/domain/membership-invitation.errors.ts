import { ApplicationError } from '../../../shared/domain/application-error';

export class MembershipInvitationInvalidError extends ApplicationError {
  readonly code = 'MEMBERSHIP_INVITATION_INVALID';
  readonly retryable = false;

  constructor() {
    super('The membership invitation is invalid or has expired.');
  }
}

export class MembershipInvitationConflictError extends ApplicationError {
  readonly code = 'MEMBERSHIP_INVITATION_CONFLICT';
  readonly retryable = false;

  constructor() {
    super('A membership or invitation already exists for this workspace.');
  }
}

export class MembershipInvitationUnavailableError extends ApplicationError {
  readonly code = 'MEMBERSHIP_INVITATION_UNAVAILABLE';
  readonly retryable = true;

  constructor() {
    super('Membership invitations are temporarily unavailable.');
  }
}
