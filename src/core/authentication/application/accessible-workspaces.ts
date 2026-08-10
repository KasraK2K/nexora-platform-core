import { Injectable } from '@nestjs/common';
import { Memberships } from '../../memberships/application/memberships';
import { Organizations } from '../../organizations/application/organizations';
import { Workspaces } from '../../workspaces/application/workspaces';
import type { WorkspaceSelectionOption } from '../domain/registration.errors';

const MAX_ACCESSIBLE_WORKSPACES = 100;

@Injectable()
export class AccessibleWorkspaces {
  constructor(
    private readonly memberships: Memberships,
    private readonly workspaces: Workspaces,
    private readonly organizations: Organizations,
  ) {}

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

  private async resolveMembership(membership: {
    userId: string;
    workspaceId: string;
    role: 'OWNER';
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

  private createOption(
    membership: { role: 'OWNER' },
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

class AccessibleWorkspaceStateError extends Error {}
class AccessibleWorkspaceLimitError extends Error {}
