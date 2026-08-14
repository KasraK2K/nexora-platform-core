import { Injectable, Logger } from '@nestjs/common';
import { AuthenticationUnavailableError } from '../domain/registration.errors';
import type { WorkspaceSelectionOption } from '../domain/registration.errors';
import { AccessibleWorkspaces } from './accessible-workspaces';

/** Lists bounded workspace choices for the already authenticated actor. */
@Injectable()
export class ListSessionWorkspaces {
  private readonly logger = new Logger(ListSessionWorkspaces.name);

  constructor(private readonly accessibleWorkspaces: AccessibleWorkspaces) {}

  /** Returns safe selection summaries or a stable availability error. */
  async execute(actorUserId: string): Promise<WorkspaceSelectionOption[]> {
    try {
      return await this.accessibleWorkspaces.listForUser(actorUserId);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'authentication.workspace_list_failed',
          errorType: error instanceof Error ? error.name : 'UnknownError',
        }),
      );
      throw new AuthenticationUnavailableError();
    }
  }
}
