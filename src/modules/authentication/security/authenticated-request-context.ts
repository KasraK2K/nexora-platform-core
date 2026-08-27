/**
 * Immutable authority resolved from the durable session and current tenant
 * records. Never construct this context from client identity, workspace, or
 * role values.
 */
export type AuthenticatedRequestContext = Readonly<{
  sessionId: string;
  actorUserId: string;
  userStatus: 'PENDING_VERIFICATION' | 'ACTIVE';
  workspaceId: string;
}>;

/**
 * Copies and freezes server-resolved authority before it crosses into the
 * presentation layer. Callers must supply values read from the durable session
 * and current membership state, never client-provided tenant or role fields.
 */
export function createAuthenticatedRequestContext(
  context: AuthenticatedRequestContext,
): AuthenticatedRequestContext {
  return Object.freeze({ ...context });
}
