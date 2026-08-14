import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../persistence/database-context';
import type { PasswordIdentityRepository } from '../application/password-identity-authentication';
import type { PasswordCredentialManagementRepository } from '../application/password-credential-management';
import type { PasswordCredentialVerificationRepository } from '../application/password-credential-verification';

/** Prisma adapter shared by Identity's password read and write contracts. */
@Injectable()
export class PrismaPasswordIdentityRepository
  implements
    PasswordIdentityRepository,
    PasswordCredentialManagementRepository,
    PasswordCredentialVerificationRepository
{
  constructor(private readonly database: DatabaseContext) {}

  /** Finds a password record by canonical email, or returns `null`. */
  findByNormalizedEmail(normalizedEmail: string) {
    return this.database.client.passwordCredential.findFirst({
      where: { identity: { normalizedEmail } },
      select: { identityId: true, passwordHash: true },
    });
  }

  /** Finds the password record for a stable identity ID, or returns `null`. */
  findByIdentityId(identityId: string) {
    return this.database.client.passwordCredential.findUnique({
      where: { identityId },
      select: { identityId: true, passwordHash: true },
    });
  }

  /** Replaces one existing credential hash and reports whether a row changed. */
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

  /**
   * Compare-and-swap replacement that rejects stale verification proof.
   * `false` means the stored hash no longer equals `expectedPasswordHash`.
   */
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
