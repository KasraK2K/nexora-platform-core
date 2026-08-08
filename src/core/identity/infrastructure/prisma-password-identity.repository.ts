import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../persistence/database-context';
import type { PasswordIdentityRepository } from '../application/password-identity-authentication';
import type { PasswordCredentialManagementRepository } from '../application/password-credential-management';

@Injectable()
export class PrismaPasswordIdentityRepository
  implements PasswordIdentityRepository, PasswordCredentialManagementRepository
{
  constructor(private readonly database: DatabaseContext) {}

  findByNormalizedEmail(normalizedEmail: string) {
    return this.database.client.passwordCredential.findFirst({
      where: { identity: { normalizedEmail } },
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
}
