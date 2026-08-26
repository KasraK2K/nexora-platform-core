import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentAuthenticatedContext,
  type AuthenticatedRequestContext,
} from '../../authentication/decorators/authenticated-request-context.decorator';
import { AuthenticatedRoute } from '../../authorization/decorators/route-admission.decorator';
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe';
import { MembershipAdministrationService } from '../membership-administration.service';
import {
  changeMembershipRoleSchema,
  transferWorkspaceOwnershipSchema,
  type ChangeMembershipRoleDto,
  type TransferWorkspaceOwnershipDto,
} from '../dto/membership-administration.dto';
import { MembershipOwnershipTransferRequestGuard } from '../guards/membership-ownership-transfer-request.guard';

/** HTTP endpoints for privileged active-workspace membership changes. */
@ApiTags('Memberships')
@Controller('v1/memberships')
export class MembershipAdministrationController {
  constructor(private readonly memberships: MembershipAdministrationService) {}

  /** Changes a visible non-owner role within the active workspace. */
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
    body: ChangeMembershipRoleDto,
    @CurrentAuthenticatedContext() context: AuthenticatedRequestContext,
  ): Promise<void> {
    await this.memberships.changeRole({
      actorUserId: context.actorUserId,
      workspaceId: context.workspaceId,
      membershipId,
      role: body.role,
    });
  }

  /** Soft-removes a visible non-owner and revokes its workspace sessions. */
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
    await this.memberships.remove({
      actorUserId: context.actorUserId,
      workspaceId: context.workspaceId,
      membershipId,
    });
  }

  /** Transfers ownership with active-session and current-password proof. */
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
    body: TransferWorkspaceOwnershipDto,
    @CurrentAuthenticatedContext() context: AuthenticatedRequestContext,
  ): Promise<void> {
    await this.memberships.transferOwnership({
      sessionId: context.sessionId,
      actorUserId: context.actorUserId,
      workspaceId: context.workspaceId,
      membershipId: body.membershipId,
      currentPassword: body.currentPassword,
    });
  }
}
