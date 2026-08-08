import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../persistence/database-context';
import type {
  IdentityLookupRepository,
  IdentitySummary,
} from '../application/identity-lookup';

@Injectable()
export class PrismaIdentityLookupRepository implements IdentityLookupRepository {
  constructor(private readonly database: DatabaseContext) {}

  findByNormalizedEmail(email: string): Promise<IdentitySummary | null> {
    return this.database.client.identity.findUnique({
      where: { normalizedEmail: email },
      select: { id: true, normalizedEmail: true },
    });
  }
}
