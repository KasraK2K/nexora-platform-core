import { Injectable } from '@nestjs/common';
import { DatabaseContext } from '../../persistence/database-context';
import type {
  AuthenticationSessionsRepository,
  SessionRecord,
} from '../application/authentication-sessions';

@Injectable()
export class PrismaAuthenticationSessionsRepository implements AuthenticationSessionsRepository {
  constructor(private readonly database: DatabaseContext) {}

  async create(input: {
    id: string;
    tokenHash: string;
    userId: string;
    activeWorkspaceId: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.database.client.session.create({ data: input });
  }

  findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return this.database.client.session.findUnique({
      where: { tokenHash },
      select: {
        userId: true,
        activeWorkspaceId: true,
        expiresAt: true,
        revokedAt: true,
      },
    });
  }
}
