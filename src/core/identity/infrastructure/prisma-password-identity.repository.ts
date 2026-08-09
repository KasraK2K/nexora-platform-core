import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../persistence/database-context';
import type { PasswordIdentityRepository } from '../application/password-identity-authentication';
import type { PasswordCredentialManagementRepository } from '../application/password-credential-management';
import type { PasswordCredentialVerificationRepository } from '../application/password-credential-verification';

@Injectable()
export class PrismaPasswordIdentityRepository
  implements
    PasswordIdentityRepository,
    PasswordCredentialManagementRepository,
    PasswordCredentialVerificationRepository
{
  constructor(private readonly database: DatabaseContext) {}

  findByNormalizedEmail(normalizedEmail: string) {
    return this.database.client.passwordCredential.findFirst({
      where: { identity: { normalizedEmail } },
      select: { identityId: true, passwordHash: true },
    });
  }

  findByIdentityId(identityId: string) {
    return this.database.client.passwordCredential.findUnique({
      where: { identityId },
      select: { identityId: true, passwordHash: true },
    });
  }

  async replacePasswordHash(
    identityId: string,
    passwordHash: string,
  ): Promise<boolean> {
    const result = await this.database.client.passwordCredential.updateMany({
      where: { identityId },
      data: { passwordHash },
    });
    return result.count === 1;
  }

  async replacePasswordHashIfCurrent(input: {
    identityId: string;
    expectedPasswordHash: string;
    passwordHash: string;
  }): Promise<boolean> {
    const result = await this.database.client.passwordCredential.updateMany({
      where: {
        identityId: input.identityId,
        passwordHash: input.expectedPasswordHash,
      },
      data: { passwordHash: input.passwordHash },
    });
    return result.count === 1;
  }
}
