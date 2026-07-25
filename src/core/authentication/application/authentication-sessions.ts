import { Inject, Injectable } from '@nestjs/common';

export const AUTHENTICATION_SESSIONS_REPOSITORY = Symbol(
  'AUTHENTICATION_SESSIONS_REPOSITORY',
);

export type SessionRecord = {
  userId: string;
  activeWorkspaceId: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export interface AuthenticationSessionsRepository {
  create(input: {
    id: string;
    tokenHash: string;
    userId: string;
    activeWorkspaceId: string;
    expiresAt: Date;
  }): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
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
}
