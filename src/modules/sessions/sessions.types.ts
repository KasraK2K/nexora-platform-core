/** PostgreSQL session state addressed by a hash of the opaque cookie secret. */
export type SessionRecord = Readonly<{
  id: string;
  tokenHash: string;
  userId: string;
  workspaceId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}>;

/** Session fields returned after atomic revocation. */
export type RevokedSession = Pick<
  SessionRecord,
  'id' | 'tokenHash' | 'userId' | 'workspaceId'
>;

/** Minimal workspace attribution recovered from a membership-backed session. */
export type SessionContext = Pick<SessionRecord, 'userId' | 'workspaceId'>;
