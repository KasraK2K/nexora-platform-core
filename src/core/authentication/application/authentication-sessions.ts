import { Inject, Injectable } from '@nestjs/common';

export const AUTHENTICATION_SESSIONS_REPOSITORY = Symbol(
  'AUTHENTICATION_SESSIONS_REPOSITORY',
);

export type SessionRecord = {
  id: string;
  tokenHash: string;
  userId: string;
  activeWorkspaceId: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export type RevokedSession = Pick<
  SessionRecord,
  'id' | 'tokenHash' | 'userId' | 'activeWorkspaceId'
>;

export type SessionContext = Pick<
  SessionRecord,
  'userId' | 'activeWorkspaceId'
>;

export interface AuthenticationSessionsRepository {
  create(input: {
    id: string;
    tokenHash: string;
    userId: string;
    activeWorkspaceId: string;
    expiresAt: Date;
  }): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  findLatestForUser(userId: string): Promise<SessionContext | null>;
  revokeByTokenHash(
    tokenHash: string,
    revokedAt: Date,
  ): Promise<RevokedSession | null>;
  revokeAllForUser(userId: string, revokedAt: Date): Promise<RevokedSession[]>;
}

@Injectable()
export class AuthenticationSessions {
  constructor(
    @Inject(AUTHENTICATION_SESSIONS_REPOSITORY)
    private readonly repository: AuthenticationSessionsRepository,
  ) {}

  create(input: {
    id: string;
    tokenHash: string;
    userId: string;
    activeWorkspaceId: string;
    expiresAt: Date;
  }): Promise<void> {
    return this.repository.create(input);
  }

  findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return this.repository.findByTokenHash(tokenHash);
  }

  findLatestForUser(userId: string): Promise<SessionContext | null> {
    return this.repository.findLatestForUser(userId);
  }

  revokeByTokenHash(
    tokenHash: string,
    revokedAt: Date,
  ): Promise<RevokedSession | null> {
    return this.repository.revokeByTokenHash(tokenHash, revokedAt);
  }

  revokeAllForUser(userId: string, revokedAt: Date): Promise<RevokedSession[]> {
    return this.repository.revokeAllForUser(userId, revokedAt);
  }
}
