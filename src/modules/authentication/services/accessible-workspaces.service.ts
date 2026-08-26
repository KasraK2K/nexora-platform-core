import { Injectable } from '@nestjs/common';
import { MembershipsService } from '../../memberships/memberships.service';
import { OrganizationsService } from '../../organizations/organizations.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import type { WorkspaceSelectionOption } from '../errors/authentication.errors';
import type { MembershipRole } from '../../memberships/memberships.service';

const MAX_ACCESSIBLE_WORKSPACES = 100;

/** Resolves the bounded set of workspaces a user may select for a session. */
@Injectable()
export class AccessibleWorkspacesService {
  constructor(
    private readonly memberships: MembershipsService,
    private readonly workspaces: WorkspacesService,
    private readonly organizations: OrganizationsService,
  ) {}

  /**
   * Builds safe workspace-selection summaries from current memberships.
   * Incomplete cross-module state or more than the bounded maximum fails closed.
   */
  async listForUser(userId: string): Promise<WorkspaceSelectionOption[]> {
    const memberships = await this.memberships.listForUser(
      userId,
      MAX_ACCESSIBLE_WORKSPACES + 1,
    );
    if (memberships.length > MAX_ACCESSIBLE_WORKSPACES) {
      throw new AccessibleWorkspaceLimitError();
    }

    const workspaces = await this.workspaces.findByIds(
      memberships.map(({ workspaceId }) => workspaceId),
    );
    const workspaceById = new Map(
      workspaces.map((workspace) => [workspace.id, workspace]),
    );
    const organizations = await this.organizations.findByIds([
      ...new Set(workspaces.map(({ organizationId }) => organizationId)),
    ]);
    const organizationById = new Map(
      organizations.map((organization) => [organization.id, organization]),
    );

    return memberships.map((membership) => {
      const workspace = workspaceById.get(membership.workspaceId);
      const organization = workspace
        ? organizationById.get(workspace.organizationId)
        : undefined;
      if (!workspace || !organization) {
        throw new AccessibleWorkspaceStateError();
      }
      return this.createOption(membership, workspace, organization);
    });
  }

  /**
   * Resolves one requested workspace only when the user currently has a
   * membership. A missing membership is indistinguishable from an unknown ID.
   */
  async findForUser(input: {
    userId: string;
    workspaceId: string;
  }): Promise<WorkspaceSelectionOption | null> {
    const membership = await this.memberships.find(input);
    if (!membership) {
      return null;
    }
    const accessible = await this.resolveMembership(membership);
    if (!accessible) {
      throw new AccessibleWorkspaceStateError();
    }
    return accessible;
  }

  /** Resolves the workspace and its organization for an authoritative membership. */
  private async resolveMembership(membership: {
    userId: string;
    workspaceId: string;
    role: MembershipRole;
  }): Promise<WorkspaceSelectionOption | null> {
    const workspace = await this.workspaces.findById(membership.workspaceId);
    if (!workspace) {
      return null;
    }
    const organization = await this.organizations.findById(
      workspace.organizationId,
    );
    if (!organization) {
      return null;
    }
    return this.createOption(membership, workspace, organization);
  }

  /** Freezes the bounded public summary so callers cannot mutate authority data. */
  private createOption(
    membership: { role: MembershipRole },
    workspace: { id: string; name: string },
    organization: { id: string; name: string },
  ): WorkspaceSelectionOption {
    return Object.freeze({
      organization: Object.freeze({ ...organization }),
      workspace: Object.freeze({ id: workspace.id, name: workspace.name }),
      membership: Object.freeze({ role: membership.role }),
    });
  }
}

/** Signals that workspace discovery found an impossible or inconsistent state. */
class AccessibleWorkspaceStateError extends Error {}

/** Signals that workspace discovery exceeded its safe bounded result size. */
class AccessibleWorkspaceLimitError extends Error {}
