import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../infrastructure/database/database-context';
import type {
  PasswordCredentialRecord,
  PasswordIdentityRecord,
} from './identity.types';

/** Private repository for Identity-owned password credential records. */
@Injectable()
export class PasswordCredentialsRepository {
  constructor(private readonly database: DatabaseContext) {}

  /** Finds a password record by canonical email, or returns `null`. */
  findByNormalizedEmail(
    normalizedEmail: string,
  ): Promise<PasswordIdentityRecord | null> {
    return this.database.client.passwordCredential.findFirst({
      where: { identity: { normalizedEmail } },
      select: { identityId: true, passwordHash: true },
    });
  }

  /** Finds the password record for a stable identity ID, or returns `null`. */
  findByIdentityId(
    identityId: string,
  ): Promise<PasswordCredentialRecord | null> {
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

  /** Compare-and-swap replacement that rejects stale verification proof. */
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
