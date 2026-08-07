import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../persistence/database-context';
import type { PasswordIdentityRepository } from '../application/password-identity-authentication';

@Injectable()
export class PrismaPasswordIdentityRepository implements PasswordIdentityRepository {
  constructor(private readonly database: DatabaseContext) {}

  findByNormalizedEmail(normalizedEmail: string) {
    return this.database.client.passwordCredential.findFirst({
      where: { identity: { normalizedEmail } },
      select: { identityId: true, passwordHash: true },
    });
  }
}
