import type { WorkspaceRole } from '../authorization/authorization.policy';

/** Minimal active membership data shared with other Core services. */
export type MembershipSummary = {
  id: string;
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
};
