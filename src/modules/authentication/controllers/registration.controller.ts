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
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe';
import { AppConfig } from '../../../config/app-config';
import { PublicRoute } from '../../authorization/route-admission.decorator';
import {
  registrationRequestSchema,
  type RegistrationDto,
} from '../dto/registration.dto';
import { RegistrationRequestGuard } from '../guards/registration-request.guard';
import { setPrivateResponseHeaders } from '../../../common/http/private-response-headers';
import { setSessionCookie } from '../http/session-cookie';
import { RegistrationService } from '../services/registration.service';

/** HTTP adapter for default account and initial-workspace registration. */
@ApiTags('Authentication')
@Controller('v1/auth')
export class RegistrationController {
  constructor(
    private readonly registration: RegistrationService,
    private readonly config: AppConfig,
  ) {}

  /** Creates the default account graph and issues its pending-user session cookie. */
  @Post('registrations')
  @HttpCode(HttpStatus.CREATED)
  @PublicRoute({ requireTrustedOrigin: true })
  @UseGuards(RegistrationRequestGuard)
  @ApiOperation({
    summary: 'Create an account and its initial workspace',
  })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['email', 'password', 'displayName', 'workspaceName'],
      properties: {
        email: { type: 'string', format: 'email', maxLength: 254 },
        password: {
          type: 'string',
          minLength: 15,
          maxLength: 128,
          writeOnly: true,
        },
        displayName: { type: 'string', minLength: 1, maxLength: 100 },
        workspaceName: { type: 'string', minLength: 1, maxLength: 120 },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Account created and session cookie issued.',
  })
  async register(
    @Body(new ZodValidationPipe(registrationRequestSchema))
    body: RegistrationDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<unknown> {
    setPrivateResponseHeaders(response);
    const account = await this.registration.register(body);
    setSessionCookie(
      response,
      this.config,
      account.sessionToken,
      account.sessionExpiresAt,
    );

    return {
      data: {
        user: {
          id: account.userId,
          displayName: account.displayName,
          status: account.status,
        },
        workspace: { id: account.workspaceId, name: account.workspaceName },
        membership: { role: 'OWNER' },
      },
      meta: {
        verificationRequired: true,
        verificationEmailQueued: account.verificationEmailQueued,
      },
    };
  }
}
