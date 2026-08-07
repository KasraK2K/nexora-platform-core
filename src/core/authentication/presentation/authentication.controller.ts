import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AppConfig } from '../../configuration/app-config';
import { GetCurrentSession } from '../application/get-current-session.use-case';
import { RegisterAccount } from '../application/register-account.use-case';
import { CreateSession } from '../application/create-session.use-case';
import { RevokeAllSessions } from '../application/revoke-all-sessions.use-case';
import { RevokeCurrentSession } from '../application/revoke-current-session.use-case';
import { LoginRequestGuard } from './login-request.guard';
import { loginRequestSchema } from './login.contract';
import type { LoginRequest } from './login.contract';
import { RegistrationRequestGuard } from './registration-request.guard';
import { registrationRequestSchema } from './registration.contract';
import type { RegistrationRequest } from './registration.contract';
import { ZodValidationPipe } from '../../../shared/presentation/zod-validation.pipe';
import { TrustedOriginGuard } from './trusted-origin.guard';

@ApiTags('Authentication')
@Controller('v1/auth')
export class AuthenticationController {
  constructor(
    private readonly registerAccount: RegisterAccount,
    private readonly createSession: CreateSession,
    private readonly getCurrentSession: GetCurrentSession,
    private readonly revokeCurrentSession: RevokeCurrentSession,
    private readonly revokeAllSessions: RevokeAllSessions,
    private readonly config: AppConfig,
  ) {}

  @Post('registrations')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(TrustedOriginGuard, RegistrationRequestGuard)
  @ApiOperation({
    summary: 'Create an account and its initial organization and workspace',
  })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: [
        'email',
        'password',
        'displayName',
        'organizationName',
        'workspaceName',
      ],
      properties: {
        email: { type: 'string', format: 'email', maxLength: 254 },
        password: {
          type: 'string',
          minLength: 15,
          maxLength: 128,
          writeOnly: true,
        },
        displayName: { type: 'string', minLength: 1, maxLength: 100 },
        organizationName: { type: 'string', minLength: 1, maxLength: 120 },
        workspaceName: { type: 'string', minLength: 1, maxLength: 120 },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Account created and session cookie issued.',
  })
  async register(
    @Body(new ZodValidationPipe(registrationRequestSchema))
    body: RegistrationRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<unknown> {
    setPrivateResponseHeaders(response);
    const account = await this.registerAccount.execute(body);
    setSessionCookie(
      response,
      this.config,
      account.sessionToken,
      account.sessionExpiresAt,
    );

    return {
      data: {
        user: { id: account.userId, displayName: account.displayName },
        organization: {
          id: account.organizationId,
          name: account.organizationName,
        },
        workspace: { id: account.workspaceId, name: account.workspaceName },
        membership: { role: 'OWNER' },
      },
      meta: {},
    };
  }

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(TrustedOriginGuard, LoginRequestGuard)
  @ApiOperation({ summary: 'Authenticate and create a new session' })
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
      },
    },
  })
  @ApiCreatedResponse({ description: 'Session created and cookie issued.' })
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<unknown> {
    setPrivateResponseHeaders(response);
    const session = await this.createSession.execute(body);
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

  @Get('session')
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Resolve the current user and trusted active workspace',
  })
  @ApiOkResponse({ description: 'Current authenticated session.' })
  async currentSession(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<unknown> {
    setPrivateResponseHeaders(response);
    const session = await this.getCurrentSession.execute(
      readCookie(request.header('cookie'), this.config.sessionCookieName),
    );
    return { data: session, meta: {} };
  }

  @Delete('session')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(TrustedOriginGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Revoke the current session' })
  @ApiNoContentResponse({ description: 'Current session revoked.' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    setPrivateResponseHeaders(response);
    await this.revokeCurrentSession.execute(
      readCookie(request.header('cookie'), this.config.sessionCookieName),
    );
    clearSessionCookie(response, this.config);
  }

  @Delete('sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(TrustedOriginGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Revoke every session for the current user' })
  @ApiNoContentResponse({ description: 'All user sessions revoked.' })
  async logoutEverywhere(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    setPrivateResponseHeaders(response);
    await this.revokeAllSessions.execute(
      readCookie(request.header('cookie'), this.config.sessionCookieName),
    );
    clearSessionCookie(response, this.config);
  }
}

function setSessionCookie(
  response: Response,
  config: AppConfig,
  token: string,
  expires: Date,
): void {
  response.cookie(config.sessionCookieName, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
    expires,
  });
}

function clearSessionCookie(response: Response, config: AppConfig): void {
  response.cookie(config.sessionCookieName, '', {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
    maxAge: 0,
  });
}

function setPrivateResponseHeaders(response: Response): void {
  response.setHeader('cache-control', 'no-store');
  response.setHeader('pragma', 'no-cache');
}

function readCookie(
  header: string | undefined,
  name: string,
): string | undefined {
  if (!header) {
    return undefined;
  }

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) {
      continue;
    }

    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }

  return undefined;
}
