import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../../../common/presentation/zod-validation.pipe';
import { clearSessionCookie } from '../../../common/presentation/clear-session-cookie';
import { AppConfig } from '../../../config/app-config';
import {
  ApplicationAuthenticatedRoute,
  AuthenticatedRoute,
  PublicRoute,
} from '../../authorization/decorators/route-admission.decorator';
import type { AuthenticatedRequestContext } from '../application/authenticated-request-context';
import type { CurrentSession } from '../services/sessions.service';
import {
  CurrentAuthenticatedContext,
  CurrentAuthenticatedSession,
} from '../decorators/authenticated-request-context.decorator';
import { loginRequestSchema, type LoginDto } from '../dto/login.dto';
import {
  workspaceSwitchSchema,
  type WorkspaceSwitchDto,
} from '../dto/workspace-switch.dto';
import { LoginRequestGuard } from '../guards/login-request.guard';
import { WorkspaceSwitchRequestGuard } from '../guards/workspace-switch-request.guard';
import { setPrivateResponseHeaders } from '../http/private-response-headers';
import { readCookie, setSessionCookie } from '../http/session-cookie';
import { SessionsService } from '../services/sessions.service';

/** HTTP adapter for opaque sessions and active-workspace selection. */
@ApiTags('Authentication')
@Controller('v1/auth')
export class SessionsController {
  constructor(
    private readonly sessions: SessionsService,
    private readonly config: AppConfig,
  ) {}

  /** Authenticates credentials, resolves an accessible tenant, and issues a session. */
  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  @PublicRoute({ requireTrustedOrigin: true })
  @UseGuards(LoginRequestGuard)
  @ApiOperation({
    operationId: 'AuthenticationController_login',
    summary: 'Authenticate and create a new session',
  })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email', maxLength: 254 },
        password: {
          type: 'string',
          minLength: 1,
          maxLength: 128,
          writeOnly: true,
        },
        workspaceId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Session created and cookie issued.' })
  @ApiConflictResponse({
    description:
      'Valid credentials require an explicit choice from the returned workspaces.',
  })
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<unknown> {
    setPrivateResponseHeaders(response);
    const session = await this.sessions.create(body);
    setSessionCookie(
      response,
      this.config,
      session.sessionToken,
      session.sessionExpiresAt,
    );

    return {
      data: {
        user: session.user,
        organization: session.organization,
        workspace: session.workspace,
        membership: session.membership,
      },
      meta: {},
    };
  }

  /** Returns the session view already resolved by the route-admission guards. */
  @Get('session')
  @AuthenticatedRoute({ allowPendingVerification: true })
  @ApiCookieAuth()
  @ApiOperation({
    operationId: 'AuthenticationController_currentSession',
    summary: 'Resolve the current user and trusted active workspace',
  })
  @ApiOkResponse({ description: 'Current authenticated session.' })
  currentSession(
    @CurrentAuthenticatedSession() session: CurrentSession,
  ): unknown {
    return { data: session, meta: {} };
  }

  /** Lists bounded workspace choices for the server-resolved actor. */
  @Get('session/workspaces')
  @AuthenticatedRoute()
  @ApiCookieAuth()
  @ApiOperation({
    operationId: 'AuthenticationController_availableWorkspaces',
    summary: 'List workspaces available to the current user',
  })
  @ApiOkResponse({ description: 'Current workspace memberships.' })
  async availableWorkspaces(
    @CurrentAuthenticatedContext() context: AuthenticatedRequestContext,
  ): Promise<unknown> {
    return {
      data: await this.sessions.listWorkspaces(context.actorUserId),
      meta: { activeWorkspaceId: context.workspaceId },
    };
  }

  /** Selects an accessible workspace and replaces the cookie when rotation occurs. */
  @Put('session/workspace')
  @AuthenticatedRoute({ requireTrustedOrigin: true })
  @UseGuards(WorkspaceSwitchRequestGuard)
  @ApiCookieAuth()
  @ApiOperation({
    operationId: 'AuthenticationController_selectWorkspace',
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
    const switched = await this.sessions.switchWorkspace({
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

  /** Idempotently revokes the presented session and clears its browser cookie. */
  @Delete('session')
  @HttpCode(HttpStatus.NO_CONTENT)
  @PublicRoute({ requireTrustedOrigin: true })
  @ApiCookieAuth()
  @ApiOperation({
    operationId: 'AuthenticationController_logout',
    summary: 'Revoke the current session',
  })
  @ApiNoContentResponse({ description: 'Current session revoked.' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    setPrivateResponseHeaders(response);
    await this.sessions.revokeCurrent(
      readCookie(request.header('cookie'), this.config.sessionCookieName),
    );
    clearSessionCookie(
      response,
      this.config.sessionCookieName,
      this.config.cookieSecure,
      this.config.cookieSameSite,
    );
  }

  /** Revokes every session for the authenticated user and clears this cookie. */
  @Delete('sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApplicationAuthenticatedRoute({ requireTrustedOrigin: true })
  @ApiCookieAuth()
  @ApiOperation({
    operationId: 'AuthenticationController_logoutEverywhere',
    summary: 'Revoke every session for the current user',
  })
  @ApiNoContentResponse({ description: 'All user sessions revoked.' })
  async logoutEverywhere(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    setPrivateResponseHeaders(response);
    await this.sessions.revokeAll(
      readCookie(request.header('cookie'), this.config.sessionCookieName),
    );
    clearSessionCookie(
      response,
      this.config.sessionCookieName,
      this.config.cookieSecure,
      this.config.cookieSameSite,
    );
  }
}
