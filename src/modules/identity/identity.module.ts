import { Module } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { PasswordCredentialsService } from './password-credentials.service';
import { IdentityRepository } from './identity.repository';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { PasswordCredentialsRepository } from './password-credentials.repository';
import { PASSWORD_VERIFIER } from './security/password-verifier';
import { Argon2PasswordVerifier } from './security/argon2-password-verifier';

/** Wires Identity application contracts to Prisma and Argon2 adapters. */
@Module({
  imports: [InfrastructureModule],
  providers: [
    IdentityService,
    PasswordCredentialsService,
    IdentityRepository,
    PasswordCredentialsRepository,
    Argon2PasswordVerifier,
    { provide: PASSWORD_VERIFIER, useExisting: Argon2PasswordVerifier },
  ],
  exports: [IdentityService, PasswordCredentialsService],
})
export class IdentityModule {}
