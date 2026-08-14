import { Inject, Injectable } from '@nestjs/common';

/** Injection token for unconditional password-hash replacement. */
export const PASSWORD_CREDENTIAL_MANAGEMENT_REPOSITORY = Symbol(
  'PASSWORD_CREDENTIAL_MANAGEMENT_REPOSITORY',
);

/** Identity-owned persistence boundary for administrative hash replacement. */
export interface PasswordCredentialManagementRepository {
  /** Replaces an existing credential hash and reports whether a row changed. */
  replacePasswordHash(
    identityId: string,
    passwordHash: string,
  ): Promise<boolean>;
}

/** Application facade for replacing an identity's stored password hash. */
@Injectable()
export class PasswordCredentialManagement {
  constructor(
    @Inject(PASSWORD_CREDENTIAL_MANAGEMENT_REPOSITORY)
    private readonly repository: PasswordCredentialManagementRepository,
  ) {}

  /** Returns `false` when no credential row exists for the identity. */
  replacePasswordHash(
    identityId: string,
    passwordHash: string,
  ): Promise<boolean> {
    return this.repository.replacePasswordHash(identityId, passwordHash);
  }
}
