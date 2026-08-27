import { Body, Controller, Patch, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import {
  CurrentAuthenticatedContext,
  type AuthenticatedRequestContext,
} from '../authentication/decorators/authenticated-request-context.decorator';
import { AuthenticatedRoute } from '../authorization/decorators/route-admission.decorator';
import {
  createWorkspaceSchema,
  type CreateWorkspaceDto,
} from './dto/create-workspace.dto';
import {
  renameCurrentWorkspaceSchema,
  type RenameCurrentWorkspaceDto,
} from './dto/rename-current-workspace.dto';
import { WorkspacesService } from './workspaces.service';

/** HTTP adapter for workspace creation and active-workspace rename. */
@ApiTags('Workspaces')
@Controller('v1/workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Post()
  @AuthenticatedRoute({ requireTrustedOrigin: true })
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Create an independently owned workspace' })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['name'],
      properties: { name: { type: 'string', minLength: 1, maxLength: 120 } },
    },
  })
  @ApiCreatedResponse({ description: 'Workspace created.' })
  async create(
    @Body(new ZodValidationPipe(createWorkspaceSchema))
    body: CreateWorkspaceDto,
    @CurrentAuthenticatedContext() context: AuthenticatedRequestContext,
  ): Promise<unknown> {
    const workspace = await this.workspaces.createOwned({
      sessionId: context.sessionId,
      actorUserId: context.actorUserId,
      currentWorkspaceId: context.workspaceId,
      name: body.name,
    });
    return {
      data: { id: workspace.id, name: workspace.name, role: 'OWNER' },
      meta: {},
    };
  }

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
      workspaceId: context.workspaceId,
      name: body.name,
    });
    return { data: { id: workspace.id, name: workspace.name }, meta: {} };
  }
}
