import { ApplicationError } from '../../../shared/domain/application-error';
import type { MembershipRole } from '../../memberships/application/membership-role';

export class InvalidRegistrationError extends ApplicationError {
  readonly code = 'REGISTRATION_INVALID';
  readonly retryable = false;

  constructor(message = 'Registration details are invalid.') {
    super(message);
  }
}

export class EmailAlreadyRegisteredError extends ApplicationError {
  readonly code = 'EMAIL_ALREADY_REGISTERED';
  readonly retryable = false;

  constructor() {
    super('Registration cannot be completed with these credentials.');
  }
}

export class RegistrationUnavailableError extends ApplicationError {
  readonly code = 'REGISTRATION_UNAVAILABLE';
  readonly retryable = true;

  constructor() {
    super('Registration is temporarily unavailable.');
  }
}

export class AuthenticationRequiredError extends ApplicationError {
  readonly code = 'AUTHENTICATION_REQUIRED';
  readonly retryable = false;

  constructor() {
    super('Authentication is required.');
  }
}

export class AuthenticationUnavailableError extends ApplicationError {
  readonly code = 'AUTHENTICATION_UNAVAILABLE';
  readonly retryable = true;

  constructor() {
    super('Authentication is temporarily unavailable.');
  }
}

export class AuthenticationInvalidError extends ApplicationError {
  readonly code = 'AUTHENTICATION_INVALID';
  readonly retryable = false;

  constructor() {
    super('Email or password is incorrect.');
  }
}

export type WorkspaceSelectionOption = Readonly<{
  organization: Readonly<{ id: string; name: string }>;
  workspace: Readonly<{ id: string; name: string }>;
  membership: Readonly<{ role: MembershipRole }>;
}>;

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

export class WorkspaceAccessDeniedError extends ApplicationError {
  readonly code = 'WORKSPACE_ACCESS_DENIED';
  readonly retryable = false;

  constructor() {
    super('The requested workspace is not available to this user.');
  }
}

export class WorkspaceSwitchUnavailableError extends ApplicationError {
  readonly code = 'WORKSPACE_SWITCH_UNAVAILABLE';
  readonly retryable = true;

  constructor() {
    super('Workspace switching is temporarily unavailable.');
  }
}

export class EmailVerificationInvalidError extends ApplicationError {
  readonly code = 'EMAIL_VERIFICATION_INVALID';
  readonly retryable = false;

  constructor() {
    super('The email verification link is invalid or has expired.');
  }
}

export class EmailVerificationUnavailableError extends ApplicationError {
  readonly code = 'EMAIL_VERIFICATION_UNAVAILABLE';
  readonly retryable = true;

  constructor() {
    super('Email verification is temporarily unavailable.');
  }
}

export class PasswordResetInvalidError extends ApplicationError {
  readonly code = 'PASSWORD_RESET_INVALID';
  readonly retryable = false;

  constructor() {
    super('The password reset link is invalid or has expired.');
  }
}

export class InvalidPasswordResetPasswordError extends ApplicationError {
  readonly code = 'PASSWORD_RESET_INVALID_PASSWORD';
  readonly retryable = false;

  constructor(
    message = 'Password must contain between 15 and 128 Unicode characters.',
  ) {
    super(message);
  }
}

export class PasswordResetUnavailableError extends ApplicationError {
  readonly code = 'PASSWORD_RESET_UNAVAILABLE';
  readonly retryable = true;

  constructor() {
    super('Password reset is temporarily unavailable.');
  }
}

export class PasswordChangeInvalidCurrentPasswordError extends ApplicationError {
  readonly code = 'PASSWORD_CHANGE_INVALID_CURRENT_PASSWORD';
  readonly retryable = false;

  constructor() {
    super('The current password is incorrect.');
  }
}

export class InvalidPasswordChangePasswordError extends ApplicationError {
  readonly code = 'PASSWORD_CHANGE_INVALID_PASSWORD';
  readonly retryable = false;

  constructor(
    message = 'Password must contain between 15 and 128 Unicode characters.',
  ) {
    super(message);
  }
}

export class PasswordChangeUnavailableError extends ApplicationError {
  readonly code = 'PASSWORD_CHANGE_UNAVAILABLE';
  readonly retryable = true;

  constructor() {
    super('Password change is temporarily unavailable.');
  }
}
