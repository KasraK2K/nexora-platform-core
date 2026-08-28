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
  ApiAcceptedResponse,
  ApiBody,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { clearSessionCookie } from '../../../common/http/clear-session-cookie';
import { setPrivateResponseHeaders } from '../../../common/http/private-response-headers';
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe';
import { AppConfig } from '../../../config/app-config';
import { PublicRoute } from '../../authorization/route-admission.decorator';
import {
  passwordResetConfirmationSchema,
  passwordResetRequestSchema,
  type PasswordResetConfirmationDto,
  type PasswordResetRequestDto,
} from '../dto/password-reset.dto';
import { PasswordResetConfirmationGuard } from '../guards/password-reset-confirmation.guard';
import { PasswordResetRequestGuard } from '../guards/password-reset-request.guard';
import { PasswordResetService } from '../services/password-reset.service';

/** HTTP adapter for password reset request and confirmation routes. */
@ApiTags('Authentication')
@Controller('v1/auth')
export class PasswordResetController {
  constructor(
    private readonly passwordReset: PasswordResetService,
    private readonly config: AppConfig,
  ) {}

  /** Accepts a reset-link request with an enumeration-resistant response. */
  @Post('password-reset-requests')
  @HttpCode(HttpStatus.ACCEPTED)
  @PublicRoute({ requireTrustedOrigin: true })
  @UseGuards(PasswordResetRequestGuard)
  @ApiOperation({
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
    await this.passwordReset.requestReset(body.email);
    return { data: null, meta: {} };
  }

  /** Replaces the password, revokes all sessions, and clears the cookie. */
  @Post('password-resets')
  @HttpCode(HttpStatus.NO_CONTENT)
  @PublicRoute({ requireTrustedOrigin: true })
  @UseGuards(PasswordResetConfirmationGuard)
  @ApiOperation({
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
    await this.passwordReset.reset({
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
}
