import { Module } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { PasswordCredentialsService } from './password-credentials.service';
import {
  IDENTITY_LOOKUP_REPOSITORY,
  IDENTITY_REGISTRATION_REPOSITORY,
} from './repositories/identity.repository';
import { PrismaIdentityRegistrationRepository } from './infrastructure/prisma-identity-registration.repository';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import {
  PASSWORD_CREDENTIAL_MANAGEMENT_REPOSITORY,
  PASSWORD_CREDENTIAL_VERIFICATION_REPOSITORY,
  PASSWORD_IDENTITY_REPOSITORY,
} from './repositories/password-credentials.repository';
import { PASSWORD_VERIFIER } from './ports/password-verifier.port';
import { Argon2PasswordVerifier } from './infrastructure/argon2-password-verifier';
import { PrismaPasswordIdentityRepository } from './infrastructure/prisma-password-identity.repository';
import { PrismaIdentityLookupRepository } from './infrastructure/prisma-identity-lookup.repository';

/** Wires Identity application contracts to Prisma and Argon2 adapters. */
@Module({
  imports: [InfrastructureModule],
  providers: [
    IdentityService,
    PasswordCredentialsService,
    PrismaIdentityRegistrationRepository,
    PrismaPasswordIdentityRepository,
    Argon2PasswordVerifier,
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
    {
      provide: PASSWORD_CREDENTIAL_MANAGEMENT_REPOSITORY,
      useExisting: PrismaPasswordIdentityRepository,
    },
    {
      provide: PASSWORD_CREDENTIAL_VERIFICATION_REPOSITORY,
      useExisting: PrismaPasswordIdentityRepository,
    },
  ],
  exports: [IdentityService, PasswordCredentialsService],
})
export class IdentityModule {}
