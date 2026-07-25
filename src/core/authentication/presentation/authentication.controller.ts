import {
  Body,
  Controller,
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
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AppConfig } from '../../configuration/app-config';
import { GetCurrentSession } from '../application/get-current-session.use-case';
import { RegisterAccount } from '../application/register-account.use-case';
import { RegistrationRequestGuard } from './registration-request.guard';
import { registrationRequestSchema } from './registration.contract';
import type { RegistrationRequest } from './registration.contract';
import { ZodValidationPipe } from '../../../shared/presentation/zod-validation.pipe';

@ApiTags('Authentication')
@Controller('v1/auth')
export class AuthenticationController {
  constructor(
    private readonly registerAccount: RegisterAccount,
    private readonly getCurrentSession: GetCurrentSession,
    private readonly config: AppConfig,
  ) {}

  @Post('registrations')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RegistrationRequestGuard)
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
    const account = await this.registerAccount.execute(body);
    setPrivateResponseHeaders(response);
    response.cookie(this.config.sessionCookieName, account.sessionToken, {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: 'lax',
      path: '/',
      expires: account.sessionExpiresAt,
    });

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
