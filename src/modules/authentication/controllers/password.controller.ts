import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBody,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../../../common/presentation/zod-validation.pipe';
import { clearSessionCookie } from '../../../common/presentation/clear-session-cookie';
import { AppConfig } from '../../../config/app-config';
import {
  ApplicationAuthenticatedRoute,
  PublicRoute,
} from '../../authorization/decorators/route-admission.decorator';
import {
  passwordChangeSchema,
  type PasswordChangeDto,
} from '../dto/password-change.dto';
import {
  passwordResetConfirmationSchema,
  passwordResetRequestSchema,
  type PasswordResetConfirmationDto,
  type PasswordResetRequestDto,
} from '../dto/password-reset.dto';
import { PasswordChangeRequestGuard } from '../guards/password-change-request.guard';
import { PasswordResetConfirmationGuard } from '../guards/password-reset-confirmation.guard';
import { PasswordResetRequestGuard } from '../guards/password-reset-request.guard';
import { setPrivateResponseHeaders } from '../http/private-response-headers';
import { readCookie, setSessionCookie } from '../http/session-cookie';
import { PasswordService } from '../services/password.service';

/** HTTP adapter for password reset and authenticated password replacement. */
@ApiTags('Authentication')
@Controller('v1/auth')
export class PasswordController {
  constructor(
    private readonly passwords: PasswordService,
    private readonly config: AppConfig,
  ) {}

  /** Accepts a reset-link request with an enumeration-resistant response. */
  @Post('password-reset-requests')
  @HttpCode(HttpStatus.ACCEPTED)
  @PublicRoute({ requireTrustedOrigin: true })
  @UseGuards(PasswordResetRequestGuard)
  @ApiOperation({
    operationId: 'AuthenticationController_requestPasswordResetLink',
    summary: 'Request a password reset link',
  })
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
  @ApiAcceptedResponse({
    description: 'The request is accepted regardless of account existence.',
  })
  async requestPasswordResetLink(
    @Body(new ZodValidationPipe(passwordResetRequestSchema))
    body: PasswordResetRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<unknown> {
    setPrivateResponseHeaders(response);
    await this.passwords.requestReset(body.email);
    return { data: null, meta: {} };
  }

  /** Replaces the password, revokes all sessions, and clears the presented cookie. */
  @Post('password-resets')
  @HttpCode(HttpStatus.NO_CONTENT)
  @PublicRoute({ requireTrustedOrigin: true })
  @UseGuards(PasswordResetConfirmationGuard)
  @ApiOperation({
    operationId: 'AuthenticationController_confirmPasswordReset',
    summary: 'Replace a password using a reset token',
  })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['token', 'newPassword'],
      properties: {
        token: {
          type: 'string',
          minLength: 43,
          maxLength: 43,
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
    description: 'Password replaced and every existing session revoked.',
  })
  async confirmPasswordReset(
    @Body(new ZodValidationPipe(passwordResetConfirmationSchema))
    body: PasswordResetConfirmationDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    setPrivateResponseHeaders(response);
    await this.passwords.reset({
      token: body.token,
      newPassword: body.newPassword,
    });
    clearSessionCookie(
      response,
      this.config.sessionCookieName,
      this.config.cookieSecure,
      this.config.cookieSameSite,
    );
  }

  /** Changes the authenticated password and replaces the browser's session cookie. */
  @Put('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApplicationAuthenticatedRoute({ requireTrustedOrigin: true })
  @UseGuards(PasswordChangeRequestGuard)
  @ApiCookieAuth()
  @ApiOperation({
    operationId: 'AuthenticationController_changeAuthenticatedPassword',
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
    const changed = await this.passwords.change({
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
