/** Runtime catalog and closed type for every expected application failure. */
export const APPLICATION_ERROR_CODES = [
  'REGISTRATION_INVALID',
  'EMAIL_ALREADY_REGISTERED',
  'REGISTRATION_UNAVAILABLE',
  'AUTHENTICATION_REQUIRED',
  'AUTHENTICATION_UNAVAILABLE',
  'AUTHENTICATION_INVALID',
  'WORKSPACE_SELECTION_REQUIRED',
  'WORKSPACE_ACCESS_DENIED',
  'WORKSPACE_SWITCH_UNAVAILABLE',
  'EMAIL_VERIFICATION_INVALID',
  'EMAIL_VERIFICATION_UNAVAILABLE',
  'PASSWORD_RESET_INVALID',
  'PASSWORD_RESET_INVALID_PASSWORD',
  'PASSWORD_RESET_UNAVAILABLE',
  'PASSWORD_CHANGE_INVALID_CURRENT_PASSWORD',
  'PASSWORD_CHANGE_INVALID_PASSWORD',
  'PASSWORD_CHANGE_UNAVAILABLE',
  'ROUTE_ACCESS_DENIED',
  'EMAIL_VERIFICATION_REQUIRED',
  'AUTHORIZATION_DENIED',
  'MEMBERSHIP_INVITATION_INVALID',
  'MEMBERSHIP_INVITATION_CONFLICT',
  'MEMBERSHIP_INVITATION_UNAVAILABLE',
  'MEMBERSHIP_PAGE_CURSOR_INVALID',
  'MEMBERSHIP_OWNERSHIP_PROTECTED',
  'MEMBERSHIPS_UNAVAILABLE',
  'USER_LIFECYCLE_INVALID',
  'USER_LIFECYCLE_UNAVAILABLE',
  'WORKSPACE_LIFECYCLE_INVALID',
  'WORKSPACE_LIFECYCLE_UNAVAILABLE',
] as const;

/** Compile-time union derived from the authoritative application-code catalog. */
export type ApplicationErrorCode = (typeof APPLICATION_ERROR_CODES)[number];

/**
 * Base class for expected business failures that may cross into presentation.
 * Subclasses provide a stable machine code and tell callers whether retrying is
 * meaningful; transports decide how to represent them.
 */
export abstract class ApplicationError extends Error {
  abstract readonly code: ApplicationErrorCode;
  abstract readonly retryable: boolean;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
