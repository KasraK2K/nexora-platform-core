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
import type { AuthenticatedRequestContext } from '../../authentication/application/authenticated-request-context';
import { CurrentAuthenticatedContext } from '../../authentication/presentation/authenticated-request-context';
import { AuthenticatedRoute } from '../../authorization/presentation/route-admission';
import { ZodValidationPipe } from '../../../shared/presentation/zod-validation.pipe';
import { AcceptMembershipInvitation } from '../application/accept-membership-invitation.use-case';
import { CreateMembershipInvitation } from '../application/create-membership-invitation.use-case';
import { RevokeMembershipInvitation } from '../application/revoke-membership-invitation.use-case';
import {
  acceptMembershipInvitationSchema,
  createMembershipInvitationSchema,
  type AcceptMembershipInvitationRequest,
  type CreateMembershipInvitationRequest,
} from './membership-invitation.contract';
import {
  MembershipInvitationAcceptRequestGuard,
  MembershipInvitationCreateRequestGuard,
} from './membership-invitation-request.guard';

/** HTTP adapter for trusted-context invitation lifecycle operations. */
@ApiTags('Membership invitations')
@Controller('v1/membership-invitations')
export class MembershipInvitationsController {
  constructor(
    private readonly createInvitation: CreateMembershipInvitation,
    private readonly acceptInvitation: AcceptMembershipInvitation,
    private readonly revokeInvitation: RevokeMembershipInvitation,
  ) {}

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
      required: ['email', 'role'],
      properties: {
        email: { type: 'string', format: 'email', maxLength: 254 },
        role: { type: 'string', enum: ['ADMIN', 'MEMBER'] },
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
    body: CreateMembershipInvitationRequest,
    @CurrentAuthenticatedContext() context: AuthenticatedRequestContext,
  ): Promise<unknown> {
    const invitation = await this.createInvitation.execute({
      actorUserId: context.actorUserId,
      workspaceId: context.workspaceId,
      email: body.email,
      role: body.role,
    });
    return {
      data: {
        id: invitation.id,
        workspaceId: invitation.workspaceId,
        email: invitation.normalizedEmail,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
      meta: { invitationEmailSent: invitation.emailSent },
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
    body: AcceptMembershipInvitationRequest,
    @CurrentAuthenticatedContext() context: AuthenticatedRequestContext,
  ): Promise<void> {
    await this.acceptInvitation.execute({
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
    await this.revokeInvitation.execute({
      actorUserId: context.actorUserId,
      workspaceId: context.workspaceId,
      invitationId,
    });
  }
}
