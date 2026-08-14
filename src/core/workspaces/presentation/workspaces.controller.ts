import { Body, Controller, Patch } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedRequestContext } from '../../authentication/application/authenticated-request-context';
import { CurrentAuthenticatedContext } from '../../authentication/presentation/authenticated-request-context';
import { AuthenticatedRoute } from '../../authorization/presentation/route-admission';
import { ZodValidationPipe } from '../../../shared/presentation/zod-validation.pipe';
import { RenameCurrentWorkspace } from '../application/rename-current-workspace.use-case';
import {
  renameCurrentWorkspaceSchema,
  type RenameCurrentWorkspaceRequest,
} from './workspace-lifecycle.contract';

/** HTTP adapter for operations on the session's active operational tenant. */
@ApiTags('Workspaces')
@Controller('v1/workspaces')
export class WorkspacesController {
  constructor(private readonly renameCurrent: RenameCurrentWorkspace) {}

  /**
   * Renames the trusted active workspace selected by server-resolved context.
   * Route admission checks coarse permission; the use case revalidates durable
   * session, membership, resource, and organization linkage before writing.
   */
  @Patch('current')
  @AuthenticatedRoute({
    requireTrustedOrigin: true,
    permission: 'workspace:update',
  })
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Rename the active workspace' })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['name'],
      properties: { name: { type: 'string', minLength: 1, maxLength: 120 } },
    },
  })
  @ApiOkResponse({ description: 'Active workspace renamed or unchanged.' })
  @ApiForbiddenResponse({ description: 'Workspace update permission denied.' })
  async rename(
    @Body(new ZodValidationPipe(renameCurrentWorkspaceSchema))
    body: RenameCurrentWorkspaceRequest,
    @CurrentAuthenticatedContext() context: AuthenticatedRequestContext,
  ): Promise<unknown> {
    const workspace = await this.renameCurrent.execute({
      sessionId: context.sessionId,
      actorUserId: context.actorUserId,
      organizationId: context.organizationId,
      workspaceId: context.workspaceId,
      name: body.name,
    });
    return {
      data: { id: workspace.id, name: workspace.name },
      meta: {},
    };
  }
}
