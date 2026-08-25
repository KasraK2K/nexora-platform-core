/** Injection token for the Users-owned persistence adapter. */
export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

/** Lifecycle states currently supported by the Users module. */
export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE';

/** Minimal profile view exposed to other Core services. */
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
  /** Inserts a user inside the caller-owned transaction. */
  create(input: {
    id: string;
    identityId: string;
    displayName: string;
    status: UserStatus;
  }): Promise<void>;
  /** Finds a public user summary by identifier. */
  findById(id: string): Promise<UserSummary | null>;
  /** Finds the identity link required by credential workflows. */
  findAuthenticationReferenceById(
    id: string,
  ): Promise<UserAuthenticationReference | null>;
  /** Finds a user by its owning identity. */
  findByIdentityId(identityId: string): Promise<UserSummary | null>;
  /** Finds an active user by its owning identity. */
  findActiveByIdentityId(identityId: string): Promise<UserSummary | null>;
  /** Transitions a pending user to active exactly once. */
  activate(id: string): Promise<boolean>;
  /** Compare-and-set updates a display name to protect concurrent writes. */
  updateDisplayName(input: {
    id: string;
    expectedDisplayName: string;
    displayName: string;
  }): Promise<boolean>;
}
