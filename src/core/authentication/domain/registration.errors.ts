import { ApplicationError } from '../../../shared/domain/application-error';

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
