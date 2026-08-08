import { Module } from '@nestjs/common';
import {
  IDENTITY_REGISTRATION_REPOSITORY,
  IdentityRegistration,
} from './application/identity-registration';
import { PrismaIdentityRegistrationRepository } from './infrastructure/prisma-identity-registration.repository';
import { CoreInfrastructureModule } from '../core-infrastructure.module';
import {
  PASSWORD_IDENTITY_REPOSITORY,
  PasswordIdentityAuthentication,
} from './application/password-identity-authentication';
import { PASSWORD_VERIFIER } from './application/password-verifier.port';
import { Argon2PasswordVerifier } from './infrastructure/argon2-password-verifier';
import { PrismaPasswordIdentityRepository } from './infrastructure/prisma-password-identity.repository';
import {
  IDENTITY_LOOKUP_REPOSITORY,
  IdentityLookup,
} from './application/identity-lookup';
import { PrismaIdentityLookupRepository } from './infrastructure/prisma-identity-lookup.repository';

@Module({
  imports: [CoreInfrastructureModule],
  providers: [
    IdentityRegistration,
    PasswordIdentityAuthentication,
    PrismaIdentityRegistrationRepository,
    PrismaPasswordIdentityRepository,
    Argon2PasswordVerifier,
    IdentityLookup,
    PrismaIdentityLookupRepository,
    {
      provide: IDENTITY_REGISTRATION_REPOSITORY,
      useExisting: PrismaIdentityRegistrationRepository,
    },
    {
      provide: PASSWORD_IDENTITY_REPOSITORY,
      useExisting: PrismaPasswordIdentityRepository,
    },
    { provide: PASSWORD_VERIFIER, useExisting: Argon2PasswordVerifier },
    {
      provide: IDENTITY_LOOKUP_REPOSITORY,
      useExisting: PrismaIdentityLookupRepository,
    },
  ],
  exports: [
    IdentityRegistration,
    PasswordIdentityAuthentication,
    IdentityLookup,
  ],
})
export class IdentityModule {}
