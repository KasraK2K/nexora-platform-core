import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { setPrivateResponseHeaders } from '../../../common/http/private-response-headers';
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe';
import { AppConfig } from '../../../config/app-config';
import { PublicRoute } from '../../authorization/route-admission.decorator';
import { loginRequestSchema, type LoginDto } from '../dto/login.dto';
import { LoginRequestGuard } from '../guards/login-request.guard';
import { setSessionCookie } from '../http/session-cookie';
import { SessionLoginService } from '../services/session-login.service';

/** HTTP adapter for credential login and session creation. */
@ApiTags('Authentication')
@Controller('v1/auth')
export class SessionLoginController {
  constructor(
    private readonly sessionLogin: SessionLoginService,
    private readonly config: AppConfig,
  ) {}

  /** Authenticates credentials, resolves a tenant, and issues a session. */
  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  @PublicRoute({ requireTrustedOrigin: true })
  @UseGuards(LoginRequestGuard)
  @ApiOperation({
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
    const session = await this.sessionLogin.create(body);
    setSessionCookie(
      response,
      this.config,
      session.sessionToken,
      session.sessionExpiresAt,
    );
    return {
      data: {
        user: session.user,
        workspace: session.workspace,
        membership: session.membership,
      },
      meta: {},
    };
  }
}
