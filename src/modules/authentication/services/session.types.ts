import type { MembershipRole } from '../../memberships/memberships.service';
import type { AuthenticatedRequestContext } from '../security/authenticated-request-context';

/** Credentials and optional workspace selector supplied by a login request. */
export type CreateSessionCommand = {
  email: string;
  password: string;
  workspaceId?: string;
};

/** Login result containing a raw cookie secret and resolved tenant view. */
export type CreatedSession = {
  user: { id: string; displayName: string };
  organization: { id: string; name: string };
  workspace: { id: string; name: string };
  membership: { role: MembershipRole };
  sessionToken: string;
  sessionExpiresAt: Date;
};

/** Public view assembled from current user, tenant, and membership state. */
export type CurrentSession = Readonly<{
  user: Readonly<{
    id: string;
    displayName: string;
    status: 'PENDING_VERIFICATION' | 'ACTIVE';
  }>;
  organization: Readonly<{ id: string; name: string }>;
  workspace: Readonly<{ id: string; name: string }>;
  membership: Readonly<{ role: MembershipRole }>;
}>;

/** Trusted authority plus its public current-session view. */
export type ResolvedAuthenticatedRequest = Readonly<{
  context: AuthenticatedRequestContext;
  currentSession: CurrentSession;
}>;

/** Public session state returned after selecting an accessible workspace. */
export type SwitchedWorkspaceSession = Readonly<{
  currentSession: CurrentSession;
  sessionToken: string;
  sessionExpiresAt: Date;
  rotated: boolean;
}>;
