import { Module } from '@nestjs/common';
import {
  IDENTITY_REGISTRATION_REPOSITORY,
  IdentityRegistration,
} from './application/identity-registration';
import { PrismaIdentityRegistrationRepository } from './infrastructure/prisma-identity-registration.repository';
import { CoreInfrastructureModule } from '../core-infrastructure.module';

@Module({
  imports: [CoreInfrastructureModule],
  providers: [
    IdentityRegistration,
    PrismaIdentityRegistrationRepository,
    {
      provide: IDENTITY_REGISTRATION_REPOSITORY,
      useExisting: PrismaIdentityRegistrationRepository,
    },
  ],
  exports: [IdentityRegistration],
})
export class IdentityModule {}
