import { Inject, Injectable } from '@nestjs/common';

/** Injection token for the Users-owned persistence adapter. */
export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

/** Lifecycle states currently supported by the Users module. */
export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE';
/** Minimal profile view exposed to other Core application services. */
export type UserSummary = {
  id: string;
  displayName: string;
  status: UserStatus;
};

/** Identity link and status view used by authentication flows. */
export type UserAuthenticationReference = {
  id: string;
  identityId: string;
  status: UserStatus;
};

/** Persistence boundary for Users-owned profile and lifecycle state. */
export interface UsersRepository {
  /** Persists a user through the caller's onboarding transaction. */
  create(input: {
    id: string;
    identityId: string;
    displayName: string;
    status: UserStatus;
  }): Promise<void>;
  /** Returns one user profile summary, or `null`. */
  findById(id: string): Promise<UserSummary | null>;
  /** Returns the identity link and status used by authentication, or `null`. */
  findAuthenticationReferenceById(
    id: string,
  ): Promise<UserAuthenticationReference | null>;
  /** Returns the user linked to an identity in any supported status. */
  findByIdentityId(identityId: string): Promise<UserSummary | null>;
  /** Returns the identity-linked user only when currently active. */
  findActiveByIdentityId(identityId: string): Promise<UserSummary | null>;
  /** Transitions a pending user to active and reports whether it changed. */
  activate(id: string): Promise<boolean>;
  /** Updates an active profile only while the expected display name matches. */
  updateDisplayName(input: {
    id: string;
    expectedDisplayName: string;
    displayName: string;
  }): Promise<boolean>;
}

/** Public application facade over Users-owned persistence operations. */
@Injectable()
export class Users {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly repository: UsersRepository,
  ) {}

  /** Creates a user as part of a caller-owned onboarding transaction. */
  create(input: {
    id: string;
    identityId: string;
    displayName: string;
    status: UserStatus;
  }): Promise<void> {
    return this.repository.create(input);
  }

  /** Returns the user profile for an ID, or `null`. */
  findById(id: string): Promise<UserSummary | null> {
    return this.repository.findById(id);
  }

  /** Returns the identity link needed to validate authentication state. */
  findAuthenticationReferenceById(
    id: string,
  ): Promise<UserAuthenticationReference | null> {
    return this.repository.findAuthenticationReferenceById(id);
  }

  /** Returns the user linked to an identity, regardless of lifecycle state. */
  findByIdentityId(identityId: string): Promise<UserSummary | null> {
    return this.repository.findByIdentityId(identityId);
  }

  /** Returns only an active user linked to the identity, or `null`. */
  findActiveByIdentityId(identityId: string): Promise<UserSummary | null> {
    return this.repository.findActiveByIdentityId(identityId);
  }

  /** Activates only a currently pending user and reports whether it changed. */
  activate(id: string): Promise<boolean> {
    return this.repository.activate(id);
  }
}
