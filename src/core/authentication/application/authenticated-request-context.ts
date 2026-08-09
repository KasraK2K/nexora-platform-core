export type AuthenticatedRequestContext = Readonly<{
  sessionId: string;
  actorUserId: string;
  userStatus: 'PENDING_VERIFICATION' | 'ACTIVE';
  organizationId: string;
  workspaceId: string;
}>;

export function createAuthenticatedRequestContext(
  context: AuthenticatedRequestContext,
): AuthenticatedRequestContext {
  return Object.freeze({ ...context });
}
