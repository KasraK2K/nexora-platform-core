import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { clearSessionCookie } from '../../common/http/session-cookie';
import { AppConfig } from '../../config/app-config';
import {
  CurrentAuthenticatedContext,
  type AuthenticatedRequestContext,
} from '../authentication/decorators/authenticated-request-context.decorator';
import { AuthenticatedRoute } from '../authorization/route-admission.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { MembershipsService } from './memberships.service';
import {
  leaveCurrentWorkspaceBodySchema,
  listWorkspaceMembershipsSchema,
  type LeaveCurrentWorkspaceDto,
  type ListWorkspaceMembershipsDto,
} from './dto/memberships.dto';

/** HTTP adapter for active-workspace membership access. */
@ApiTags('Memberships')
@Controller('v1/memberships')
export class MembershipsController {
  constructor(
    private readonly memberships: MembershipsService,
    private readonly config: AppConfig,
  ) {}

  /** Lists a bounded page using the server-resolved active workspace. */
  @Get()
  @AuthenticatedRoute({ permission: 'membership:read' })
  @ApiCookieAuth()
  @ApiOperation({ summary: 'List active-workspace memberships' })
  @ApiQuery({ name: 'cursor', required: false, type: String, format: 'uuid' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiOkResponse({ description: 'A cursor-bounded membership page.' })
  @ApiForbiddenResponse({ description: 'Membership read permission denied.' })
  async list(
    @Query(new ZodValidationPipe(listWorkspaceMembershipsSchema))
    query: ListWorkspaceMembershipsDto,
    @CurrentAuthenticatedContext() context: AuthenticatedRequestContext,
  ): Promise<unknown> {
    const page = await this.memberships.listWorkspace({
      actorUserId: context.actorUserId,
      workspaceId: context.workspaceId,
      cursor: query.cursor,
      limit: query.limit,
    });
    return {
      data: page.memberships,
      meta: { nextCursor: page.nextCursor },
    };
  }

  /**
   * Leaves the active workspace and clears the presented cookie only after the
   * transactional leave succeeds and its workspace-local sessions are revoked.
   */
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthenticatedRoute({
    requireTrustedOrigin: true,
    permission: 'membership:self:leave',
  })
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Leave the active workspace' })
  @ApiBody({
    required: false,
    schema: { type: 'object', additionalProperties: false, maxProperties: 0 },
  })
  @ApiNoContentResponse({ description: 'Active workspace membership left.' })
  @ApiForbiddenResponse({ description: 'Workspace leave permission denied.' })
  @ApiConflictResponse({
    description: 'Workspace ownership or final membership is protected.',
  })
  async leave(
    @Body(new ZodValidationPipe(leaveCurrentWorkspaceBodySchema))
    _body: LeaveCurrentWorkspaceDto,
    @CurrentAuthenticatedContext() context: AuthenticatedRequestContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.memberships.leaveCurrent({
      sessionId: context.sessionId,
      actorUserId: context.actorUserId,
      workspaceId: context.workspaceId,
    });
    clearSessionCookie(response, this.config);
  }

  /** Removes a member from the active workspace as its permanent owner. */
  @Delete(':membershipId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthenticatedRoute({
    requireTrustedOrigin: true,
    permission: 'membership:remove',
  })
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Remove a member from the active workspace' })
  @ApiNoContentResponse({ description: 'Member removed or not visible.' })
  @ApiForbiddenResponse({ description: 'Membership removal denied.' })
  @ApiConflictResponse({ description: 'Permanent ownership is protected.' })
  async remove(
    @Param('membershipId', new ParseUUIDPipe()) membershipId: string,
    @CurrentAuthenticatedContext() context: AuthenticatedRequestContext,
  ): Promise<void> {
    await this.memberships.remove({
      actorUserId: context.actorUserId,
      workspaceId: context.workspaceId,
      membershipId,
    });
  }
}
