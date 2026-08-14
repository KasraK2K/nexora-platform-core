import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../persistence/database-context';
import type {
  IdentityLookupRepository,
  IdentitySummary,
} from '../application/identity-lookup';

/** Prisma adapter for minimal Identity principal reads. */
@Injectable()
export class PrismaIdentityLookupRepository implements IdentityLookupRepository {
  constructor(private readonly database: DatabaseContext) {}

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
