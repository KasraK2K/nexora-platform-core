/** Injection token for the environment-level browser security policy. */
export const SECURITY_POLICY = Symbol('SECURITY_POLICY');

/** Supplies security-relevant environment facts without exposing all config. */
export interface SecurityPolicy {
  readonly isProduction: boolean;
}
