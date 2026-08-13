/**
 * Immutable authority resolved from the durable session and current tenant
 * records. Never construct this context from client identity, workspace,
 * organization, or role values.
 */
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
