export const SECURITY_POLICY = Symbol('SECURITY_POLICY');

export interface SecurityPolicy {
  readonly isProduction: boolean;
}
