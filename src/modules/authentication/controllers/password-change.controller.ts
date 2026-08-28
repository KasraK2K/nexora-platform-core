import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { setPrivateResponseHeaders } from '../../../common/http/private-response-headers';
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe';
import { AppConfig } from '../../../config/app-config';
import { ApplicationAuthenticatedRoute } from '../../authorization/route-admission.decorator';
import {
  passwordChangeSchema,
  type PasswordChangeDto,
} from '../dto/password-change.dto';
import { PasswordChangeRequestGuard } from '../guards/password-change-request.guard';
import { readCookie, setSessionCookie } from '../http/session-cookie';
import { PasswordChangeService } from '../services/password-change.service';

/** HTTP adapter for authenticated password replacement. */
@ApiTags('Authentication')
@Controller('v1/auth')
export class PasswordChangeController {
  constructor(
    private readonly passwordChange: PasswordChangeService,
    private readonly config: AppConfig,
  ) {}

  /** Changes the password and replaces the browser's session cookie. */
  @Put('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApplicationAuthenticatedRoute({ requireTrustedOrigin: true })
  @UseGuards(PasswordChangeRequestGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Change the current user password',
  })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['currentPassword', 'newPassword'],
      properties: {
        currentPassword: {
          type: 'string',
          minLength: 1,
          maxLength: 128,
          writeOnly: true,
        },
        newPassword: {
          type: 'string',
          minLength: 15,
          maxLength: 128,
          writeOnly: true,
        },
      },
    },
  })
  @ApiNoContentResponse({
    description:
      'Password changed, existing sessions revoked, and current session rotated.',
  })
  async changeAuthenticatedPassword(
    @Body(new ZodValidationPipe(passwordChangeSchema))
    body: PasswordChangeDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    setPrivateResponseHeaders(response);
    const changed = await this.passwordChange.change({
      rawSessionToken: readCookie(
        request.header('cookie'),
        this.config.sessionCookieName,
      ),
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });
    setSessionCookie(
      response,
      this.config,
      changed.sessionToken,
      changed.sessionExpiresAt,
    );
  }
}
