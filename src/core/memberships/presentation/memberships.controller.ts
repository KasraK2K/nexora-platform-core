import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
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
import { AppConfig } from '../../configuration/app-config';
import type { AuthenticatedRequestContext } from '../../authentication/application/authenticated-request-context';
import { CurrentAuthenticatedContext } from '../../authentication/presentation/authenticated-request-context';
import { AuthenticatedRoute } from '../../authorization/presentation/route-admission';
import { clearSessionCookie } from '../../../shared/presentation/clear-session-cookie';
import { ZodValidationPipe } from '../../../shared/presentation/zod-validation.pipe';
import { ChangeMembershipRole } from '../application/change-membership-role.use-case';
import { ListWorkspaceMemberships } from '../application/list-workspace-memberships.use-case';
import { LeaveCurrentWorkspace } from '../application/leave-current-workspace.use-case';
import { RemoveMembership } from '../application/remove-membership.use-case';
import { TransferWorkspaceOwnership } from '../application/transfer-workspace-ownership.use-case';
import {
  changeMembershipRoleSchema,
  leaveCurrentWorkspaceBodySchema,
  listWorkspaceMembershipsSchema,
  transferWorkspaceOwnershipSchema,
  type ChangeMembershipRoleRequest,
  type LeaveCurrentWorkspaceBody,
  type ListWorkspaceMembershipsRequest,
  type TransferWorkspaceOwnershipRequest,
} from './membership-administration.contract';
import { MembershipOwnershipTransferRequestGuard } from './membership-ownership-transfer-request.guard';

@ApiTags('Memberships')
@Controller('v1/memberships')
export class MembershipsController {
  constructor(
    private readonly listMemberships: ListWorkspaceMemberships,
    private readonly leaveCurrentWorkspace: LeaveCurrentWorkspace,
    private readonly changeRole: ChangeMembershipRole,
    private readonly removeMembership: RemoveMembership,
    private readonly transferOwnership: TransferWorkspaceOwnership,
    private readonly config: AppConfig,
  ) {}

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
    query: ListWorkspaceMembershipsRequest,
    @CurrentAuthenticatedContext() context: AuthenticatedRequestContext,
  ): Promise<unknown> {
    const page = await this.listMemberships.execute({
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
    _body: LeaveCurrentWorkspaceBody,
    @CurrentAuthenticatedContext() context: AuthenticatedRequestContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.leaveCurrentWorkspace.execute({
      sessionId: context.sessionId,
      actorUserId: context.actorUserId,
      workspaceId: context.workspaceId,
    });
    clearSessionCookie(
      response,
      this.config.sessionCookieName,
      this.config.cookieSecure,
    );
  }

  @Patch(':membershipId/role')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthenticatedRoute({
    requireTrustedOrigin: true,
    permission: 'membership:role:update',
  })
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Change a non-owner membership role' })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['role'],
      properties: { role: { type: 'string', enum: ['ADMIN', 'MEMBER'] } },
    },
  })
  @ApiNoContentResponse({
    description: 'Membership role updated or unchanged.',
  })
  @ApiForbiddenResponse({ description: 'Role update permission denied.' })
  @ApiConflictResponse({ description: 'Workspace ownership is protected.' })
  async updateRole(
    @Param('membershipId', new ParseUUIDPipe()) membershipId: string,
    @Body(new ZodValidationPipe(changeMembershipRoleSchema))
    body: ChangeMembershipRoleRequest,
    @CurrentAuthenticatedContext() context: AuthenticatedRequestContext,
  ): Promise<void> {
    await this.changeRole.execute({
      actorUserId: context.actorUserId,
      workspaceId: context.workspaceId,
      membershipId,
      role: body.role,
    });
  }

  @Delete(':membershipId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthenticatedRoute({
    requireTrustedOrigin: true,
    permission: 'membership:remove',
  })
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Remove a non-owner active-workspace membership' })
  @ApiNoContentResponse({
    description: 'Membership removed or not visible in the active workspace.',
  })
  @ApiForbiddenResponse({
    description: 'Membership removal permission denied.',
  })
  @ApiConflictResponse({ description: 'Workspace ownership is protected.' })
  async remove(
    @Param('membershipId', new ParseUUIDPipe()) membershipId: string,
    @CurrentAuthenticatedContext() context: AuthenticatedRequestContext,
  ): Promise<void> {
    await this.removeMembership.execute({
      actorUserId: context.actorUserId,
      workspaceId: context.workspaceId,
      membershipId,
    });
  }

  @Put('owner')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthenticatedRoute({
    requireTrustedOrigin: true,
    permission: 'membership:ownership:transfer',
  })
  @UseGuards(MembershipOwnershipTransferRequestGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Transfer active-workspace operational ownership' })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['membershipId', 'currentPassword'],
      properties: {
        membershipId: { type: 'string', format: 'uuid' },
        currentPassword: {
          type: 'string',
          minLength: 1,
          maxLength: 512,
          description:
            'Maximum 128 normalized Unicode code points and 512 UTF-8 bytes.',
          writeOnly: true,
        },
      },
    },
  })
  @ApiNoContentResponse({ description: 'Workspace ownership transferred.' })
  @ApiBadRequestResponse({ description: 'Transfer confirmation was invalid.' })
  @ApiForbiddenResponse({
    description: 'Ownership transfer permission denied.',
  })
  async transferWorkspaceOwner(
    @Body(new ZodValidationPipe(transferWorkspaceOwnershipSchema))
    body: TransferWorkspaceOwnershipRequest,
    @CurrentAuthenticatedContext() context: AuthenticatedRequestContext,
  ): Promise<void> {
    await this.transferOwnership.execute({
      sessionId: context.sessionId,
      actorUserId: context.actorUserId,
      workspaceId: context.workspaceId,
      membershipId: body.membershipId,
      currentPassword: body.currentPassword,
    });
  }
}
