import { Inject, Injectable } from '@nestjs/common';

export const IDENTITY_REGISTRATION_REPOSITORY = Symbol(
  'IDENTITY_REGISTRATION_REPOSITORY',
);

export type CreatePasswordIdentity = {
  identityId: string;
  normalizedEmail: string;
  passwordHash: string;
};

export interface IdentityRegistrationRepository {
  createPasswordIdentity(input: CreatePasswordIdentity): Promise<void>;
}

@Injectable()
export class IdentityRegistration {
  constructor(
    @Inject(IDENTITY_REGISTRATION_REPOSITORY)
    private readonly repository: IdentityRegistrationRepository,
  ) {}

  createPasswordIdentity(input: CreatePasswordIdentity): Promise<void> {
    return this.repository.createPasswordIdentity(input);
  }
}
