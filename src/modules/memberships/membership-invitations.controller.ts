import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentAuthenticatedContext,
  type AuthenticatedRequestContext,
} from '../authentication/decorators/authenticated-request-context.decorator';
import { AuthenticatedRoute } from '../authorization/decorators/route-admission.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { MembershipInvitationsService } from './membership-invitations.service';
import {
  acceptMembershipInvitationSchema,
  createMembershipInvitationSchema,
  type AcceptMembershipInvitationDto,
  type CreateMembershipInvitationDto,
} from './dto/membership-invitation.dto';
import {
  MembershipInvitationAcceptRequestGuard,
  MembershipInvitationCreateRequestGuard,
} from './guards/membership-invitation-request.guard';

/** HTTP adapter for trusted-context invitation lifecycle operations. */
@ApiTags('Membership invitations')
@Controller('v1/membership-invitations')
export class MembershipInvitationsController {
  constructor(private readonly invitations: MembershipInvitationsService) {}

  /** Creates an email-bound non-owner invitation in the active workspace. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AuthenticatedRoute({
    requireTrustedOrigin: true,
    permission: 'membership-invitation:create',
  })
  @UseGuards(MembershipInvitationCreateRequestGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Invite a user to the active workspace' })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['email'],
      properties: {
        email: { type: 'string', format: 'email', maxLength: 254 },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Membership invitation created.' })
  @ApiForbiddenResponse({ description: 'Invitation permission denied.' })
  @ApiConflictResponse({
    description: 'A membership or active invitation already exists.',
  })
  async create(
    @Body(new ZodValidationPipe(createMembershipInvitationSchema))
    body: CreateMembershipInvitationDto,
    @CurrentAuthenticatedContext() context: AuthenticatedRequestContext,
  ): Promise<unknown> {
    const invitation = await this.invitations.create({
      actorUserId: context.actorUserId,
      workspaceId: context.workspaceId,
      email: body.email,
    });
    return {
      data: {
        id: invitation.id,
        workspaceId: invitation.workspaceId,
        email: invitation.normalizedEmail,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
      meta: { invitationEmailQueued: invitation.emailQueued },
    };
  }

  /**
   * Accepts an invitation for the authenticated actor's email. The invitation's
   * stored workspace, not the actor's current workspace, determines membership.
   */
  @Post('acceptances')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthenticatedRoute({ requireTrustedOrigin: true })
  @UseGuards(MembershipInvitationAcceptRequestGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Accept an email-bound membership invitation' })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['token'],
      properties: {
        token: {
          type: 'string',
          minLength: 43,
          maxLength: 43,
          writeOnly: true,
        },
      },
    },
  })
  @ApiNoContentResponse({ description: 'Membership invitation accepted.' })
  async accept(
    @Body(new ZodValidationPipe(acceptMembershipInvitationSchema))
    body: AcceptMembershipInvitationDto,
    @CurrentAuthenticatedContext() context: AuthenticatedRequestContext,
  ): Promise<void> {
    await this.invitations.accept({
      actorUserId: context.actorUserId,
      token: body.token,
    });
  }

  /** Revokes an invitation visible and manageable in the active workspace. */
  @Delete(':invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthenticatedRoute({
    requireTrustedOrigin: true,
    permission: 'membership-invitation:revoke',
  })
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Revoke an active-workspace membership invitation' })
  @ApiNoContentResponse({
    description: 'Invitation revoked or not visible in the active workspace.',
  })
  async revoke(
    @Param('invitationId', new ParseUUIDPipe()) invitationId: string,
    @CurrentAuthenticatedContext() context: AuthenticatedRequestContext,
  ): Promise<void> {
    await this.invitations.revoke({
      actorUserId: context.actorUserId,
      workspaceId: context.workspaceId,
      invitationId,
    });
  }
}
