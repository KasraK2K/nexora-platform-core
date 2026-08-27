/** Lifecycle states currently supported by the Users module. */
export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE';

/** Minimal profile view exposed to other Core services. */
export type UserSummary = {
  id: string;
  displayName: string;
  status: UserStatus;
};

/** Account data used by authentication workflows without exposing a hash. */
export type UserAccount = UserSummary & {
  normalizedEmail: string;
};

/** Private credential projection used only inside the Users module. */
export type UserCredential = {
  id: string;
  passwordHash: string;
};
