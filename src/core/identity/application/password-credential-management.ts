import { Inject, Injectable } from '@nestjs/common';

export const PASSWORD_CREDENTIAL_MANAGEMENT_REPOSITORY = Symbol(
  'PASSWORD_CREDENTIAL_MANAGEMENT_REPOSITORY',
);

export interface PasswordCredentialManagementRepository {
  replacePasswordHash(
    identityId: string,
    passwordHash: string,
  ): Promise<boolean>;
}

@Injectable()
export class PasswordCredentialManagement {
  constructor(
    @Inject(PASSWORD_CREDENTIAL_MANAGEMENT_REPOSITORY)
    private readonly repository: PasswordCredentialManagementRepository,
  ) {}

  replacePasswordHash(
    identityId: string,
    passwordHash: string,
  ): Promise<boolean> {
    return this.repository.replacePasswordHash(identityId, passwordHash);
  }
}
