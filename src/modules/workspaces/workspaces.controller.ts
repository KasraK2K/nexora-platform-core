import { Body, Controller, Patch } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentAuthenticatedContext,
  type AuthenticatedRequestContext,
} from '../authentication/decorators/authenticated-request-context.decorator';
import { AuthenticatedRoute } from '../authorization/decorators/route-admission.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import {
  renameCurrentWorkspaceSchema,
  type RenameCurrentWorkspaceDto,
} from './dto/rename-current-workspace.dto';
import { WorkspacesService } from './workspaces.service';

/** HTTP adapter for operations on the session's active operational tenant. */
@ApiTags('Workspaces')
@Controller('v1/workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  /** Validates and maps the trusted active-workspace rename. */
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
    body: RenameCurrentWorkspaceDto,
    @CurrentAuthenticatedContext() context: AuthenticatedRequestContext,
  ): Promise<unknown> {
    const workspace = await this.workspaces.renameCurrent({
      sessionId: context.sessionId,
      actorUserId: context.actorUserId,
      organizationId: context.organizationId,
      workspaceId: context.workspaceId,
      name: body.name,
    });
    return { data: { id: workspace.id, name: workspace.name }, meta: {} };
  }
}
