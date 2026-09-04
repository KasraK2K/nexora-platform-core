import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  readCookie,
  setSessionCookie,
} from '../../../common/http/session-cookie';
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe';
import { AppConfig } from '../../../config/app-config';
import { AuthenticatedRoute } from '../../authorization/route-admission.decorator';
import type { AuthenticatedRequestContext } from '../security/authenticated-request-context';
import { CurrentAuthenticatedContext } from '../decorators/authenticated-request-context.decorator';
import {
  workspaceSwitchSchema,
  type WorkspaceSwitchDto,
} from '../dto/workspace-switch.dto';
import { WorkspaceSwitchRequestGuard } from '../guards/workspace-switch-request.guard';
import { WorkspaceSessionService } from '../services/workspace-session.service';

/** HTTP adapter for accessible-workspace listing and active-tenant switching. */
@ApiTags('Authentication')
@Controller('v1/auth')
export class WorkspaceSessionController {
  constructor(
    private readonly workspaceSessions: WorkspaceSessionService,
    private readonly config: AppConfig,
  ) {}

  /** Lists bounded workspace choices for the server-resolved actor. */
  @Get('session/workspaces')
  @AuthenticatedRoute()
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'List workspaces available to the current user',
  })
  @ApiOkResponse({ description: 'Current workspace memberships.' })
  async availableWorkspaces(
    @CurrentAuthenticatedContext() context: AuthenticatedRequestContext,
  ): Promise<unknown> {
    return {
      data: await this.workspaceSessions.listWorkspaces(context.actorUserId),
      meta: { workspaceId: context.workspaceId },
    };
  }

  /** Selects an accessible workspace and rotates the cookie when required. */
  @Put('session/workspace')
  @AuthenticatedRoute({ requireTrustedOrigin: true })
  @UseGuards(WorkspaceSwitchRequestGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Switch the active workspace for this session',
  })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['workspaceId'],
      properties: { workspaceId: { type: 'string', format: 'uuid' } },
    },
  })
  @ApiOkResponse({
    description:
      'Active workspace switched and the opaque session cookie rotated.',
  })
  @ApiForbiddenResponse({
    description: 'The requested workspace is not available to this user.',
  })
  async selectWorkspace(
    @Body(new ZodValidationPipe(workspaceSwitchSchema))
    body: WorkspaceSwitchDto,
    @CurrentAuthenticatedContext() context: AuthenticatedRequestContext,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<unknown> {
    const switched = await this.workspaceSessions.switchWorkspace({
      rawSessionToken: readCookie(
        request.header('cookie'),
        this.config.sessionCookieName,
      ),
      expectedContext: context,
      workspaceId: body.workspaceId,
    });
    setSessionCookie(
      response,
      this.config,
      switched.sessionToken,
      switched.sessionExpiresAt,
    );
    return {
      data: switched.currentSession,
      meta: { sessionRotated: switched.rotated },
    };
  }
}
