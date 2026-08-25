import { ApplicationError } from '../../../common/domain/application-error';

/** Stable validation failure for registration input or password policy. */
export class InvalidRegistrationError extends ApplicationError {
  readonly code = 'REGISTRATION_INVALID';
  readonly retryable = false;

  constructor(message = 'Registration details are invalid.') {
    super(message);
  }
}

/** Enumeration-safe conflict returned when registration cannot claim the email. */
export class EmailAlreadyRegisteredError extends ApplicationError {
  readonly code = 'EMAIL_ALREADY_REGISTERED';
  readonly retryable = false;

  constructor() {
    super('Registration cannot be completed with these credentials.');
  }
}

/** Retryable registration infrastructure failure with no internal details. */
export class RegistrationUnavailableError extends ApplicationError {
  readonly code = 'REGISTRATION_UNAVAILABLE';
  readonly retryable = true;

  constructor() {
    super('Registration is temporarily unavailable.');
  }
}

/** The request has no valid, current authenticated session authority. */
export class AuthenticationRequiredError extends ApplicationError {
  readonly code = 'AUTHENTICATION_REQUIRED';
  readonly retryable = false;

  constructor() {
    super('Authentication is required.');
  }
}

/** Authentication could not be decided because a required dependency failed. */
export class AuthenticationUnavailableError extends ApplicationError {
  readonly code = 'AUTHENTICATION_UNAVAILABLE';
  readonly retryable = true;

  constructor() {
    super('Authentication is temporarily unavailable.');
  }
}

/** Generic credential or selected-workspace failure that resists enumeration. */
export class AuthenticationInvalidError extends ApplicationError {
  readonly code = 'AUTHENTICATION_INVALID';
  readonly retryable = false;

  constructor() {
    super('Email or password is incorrect.');
  }
}

/** Bounded, safe tenant summary offered after valid multi-workspace credentials. */
export type WorkspaceSelectionOption = Readonly<{
  organization: Readonly<{ id: string; name: string }>;
  workspace: Readonly<{ id: string; name: string }>;
  membership: Readonly<{ role: 'OWNER' | 'ADMIN' | 'MEMBER' }>;
}>;

/** Valid credentials require the caller to choose one accessible workspace. */
export class WorkspaceSelectionRequiredError extends ApplicationError {
  readonly code = 'WORKSPACE_SELECTION_REQUIRED';
  readonly retryable = false;
  readonly details: Readonly<{
    availableWorkspaces: readonly WorkspaceSelectionOption[];
  }>;

  constructor(availableWorkspaces: readonly WorkspaceSelectionOption[]) {
    super('Select a workspace to continue.');
    this.details = Object.freeze({
      availableWorkspaces: Object.freeze([...availableWorkspaces]),
    });
  }
}

/** The authenticated actor has no current membership in the requested workspace. */
export class WorkspaceAccessDeniedError extends ApplicationError {
  readonly code = 'WORKSPACE_ACCESS_DENIED';
  readonly retryable = false;

  constructor() {
    super('The requested workspace is not available to this user.');
  }
}

/** Workspace switching failed for an internal, retryable reason. */
export class WorkspaceSwitchUnavailableError extends ApplicationError {
  readonly code = 'WORKSPACE_SWITCH_UNAVAILABLE';
  readonly retryable = true;

  constructor() {
    super('Workspace switching is temporarily unavailable.');
  }
}

/** A verification token is malformed, expired, consumed, invalidated, or unknown. */
export class EmailVerificationInvalidError extends ApplicationError {
  readonly code = 'EMAIL_VERIFICATION_INVALID';
  readonly retryable = false;

  constructor() {
    super('The email verification link is invalid or has expired.');
  }
}

/** Email verification could not complete because a dependency failed. */
export class EmailVerificationUnavailableError extends ApplicationError {
  readonly code = 'EMAIL_VERIFICATION_UNAVAILABLE';
  readonly retryable = true;

  constructor() {
    super('Email verification is temporarily unavailable.');
  }
}

/** A reset token is malformed, expired, consumed, invalidated, or unknown. */
export class PasswordResetInvalidError extends ApplicationError {
  readonly code = 'PASSWORD_RESET_INVALID';
  readonly retryable = false;

  constructor() {
    super('The password reset link is invalid or has expired.');
  }
}

/** The proposed reset password fails password or compromise policy. */
export class InvalidPasswordResetPasswordError extends ApplicationError {
  readonly code = 'PASSWORD_RESET_INVALID_PASSWORD';
  readonly retryable = false;

  constructor(
    message = 'Password must contain between 15 and 128 Unicode characters.',
  ) {
    super(message);
  }
}

/** Password reset could not complete because a dependency failed. */
export class PasswordResetUnavailableError extends ApplicationError {
  readonly code = 'PASSWORD_RESET_UNAVAILABLE';
  readonly retryable = true;

  constructor() {
    super('Password reset is temporarily unavailable.');
  }
}

/** Current-password proof failed or became stale before credential replacement. */
export class PasswordChangeInvalidCurrentPasswordError extends ApplicationError {
  readonly code = 'PASSWORD_CHANGE_INVALID_CURRENT_PASSWORD';
  readonly retryable = false;

  constructor() {
    super('The current password is incorrect.');
  }
}

/** The proposed replacement fails password or compromise policy. */
export class InvalidPasswordChangePasswordError extends ApplicationError {
  readonly code = 'PASSWORD_CHANGE_INVALID_PASSWORD';
  readonly retryable = false;

  constructor(
    message = 'Password must contain between 15 and 128 Unicode characters.',
  ) {
    super(message);
  }
}

/** Password change could not complete because a dependency failed. */
export class PasswordChangeUnavailableError extends ApplicationError {
  readonly code = 'PASSWORD_CHANGE_UNAVAILABLE';
  readonly retryable = true;

  constructor() {
    super('Password change is temporarily unavailable.');
  }
}
