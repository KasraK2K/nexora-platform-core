import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../persistence/database-context';
import type {
  CreatePasswordIdentity,
  IdentityRegistrationRepository,
} from '../application/identity-registration';
import { IdentityAlreadyExistsError } from '../domain/identity-already-exists.error';

@Injectable()
export class PrismaIdentityRegistrationRepository implements IdentityRegistrationRepository {
  constructor(private readonly database: DatabaseContext) {}

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
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
