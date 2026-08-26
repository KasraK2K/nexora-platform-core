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
