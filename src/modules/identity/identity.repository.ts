import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../infrastructure/database/database-context';
import { IdentityAlreadyExistsError } from './identity-already-exists.error';
import type { CreatePasswordIdentity, IdentitySummary } from './identity.types';

/** Private repository for Identity-owned principal records. */
@Injectable()
export class IdentityRepository {
  constructor(private readonly database: DatabaseContext) {}

  /** Creates the principal and password credential in the active transaction. */
  async createPasswordIdentity(input: CreatePasswordIdentity): Promise<void> {
    try {
      await this.database.client.identity.create({
        data: { id: input.identityId, normalizedEmail: input.normalizedEmail },
      });
      await this.database.client.passwordCredential.create({
        data: {
          identityId: input.identityId,
          passwordHash: input.passwordHash,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new IdentityAlreadyExistsError();
      }
      throw error;
    }
  }

  /** Returns the unique canonical-email match, or `null`. */
  findByNormalizedEmail(email: string): Promise<IdentitySummary | null> {
    return this.database.client.identity.findUnique({
      where: { normalizedEmail: email },
      select: { id: true, normalizedEmail: true },
    });
  }

  /** Returns the principal summary for a stable ID, or `null`. */
  findById(id: string): Promise<IdentitySummary | null> {
    return this.database.client.identity.findUnique({
      where: { id },
      select: { id: true, normalizedEmail: true },
    });
  }
}

/** Narrows Prisma's untrusted uniqueness error without leaking ORM types. */
function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
