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
  ApiAcceptedResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AppConfig } from '../../configuration/app-config';
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
import { RequestEmailVerification } from '../application/request-email-verification.use-case';
import { VerifyEmail } from '../application/verify-email.use-case';
import {
  emailVerificationConfirmationSchema,
  emailVerificationRequestSchema,
  type EmailVerificationConfirmation,
  type EmailVerificationRequest,
} from './email-verification.contract';
import { EmailVerificationRequestGuard } from './email-verification-request.guard';
import { EmailVerificationConfirmationGuard } from './email-verification-confirmation.guard';
import { RequestPasswordReset } from '../application/request-password-reset.use-case';
import { ResetPassword } from '../application/reset-password.use-case';
import {
  passwordResetConfirmationSchema,
  passwordResetRequestSchema,
  type PasswordResetConfirmation,
  type PasswordResetRequest,
} from './password-reset.contract';
import { PasswordResetRequestGuard } from './password-reset-request.guard';
import { PasswordResetConfirmationGuard } from './password-reset-confirmation.guard';
import { ChangePassword } from '../application/change-password.use-case';
import {
  passwordChangeSchema,
  type PasswordChangeRequest,
} from './password-change.contract';
import { PasswordChangeRequestGuard } from './password-change-request.guard';
import { setPrivateResponseHeaders } from './private-response-headers';
import { readCookie } from './session-cookie';
import { AuthenticatedRequestContextGuard } from './authenticated-request-context.guard';
import { CurrentAuthenticatedSession } from './authenticated-request-context';
import type { CurrentSession } from '../application/get-current-session.use-case';

@ApiTags('Authentication')
@Controller('v1/auth')
export class AuthenticationController {
  constructor(
    private readonly registerAccount: RegisterAccount,
    private readonly createSession: CreateSession,
    private readonly revokeCurrentSession: RevokeCurrentSession,
    private readonly revokeAllSessions: RevokeAllSessions,
    private readonly requestEmailVerification: RequestEmailVerification,
    private readonly verifyEmail: VerifyEmail,
    private readonly requestPasswordReset: RequestPasswordReset,
    private readonly resetPassword: ResetPassword,
    private readonly changePassword: ChangePassword,
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
        user: {
          id: account.userId,
          displayName: account.displayName,
          status: account.status,
        },
        organization: {
          id: account.organizationId,
          name: account.organizationName,
        },
        workspace: { id: account.workspaceId, name: account.workspaceName },
        membership: { role: 'OWNER' },
      },
      meta: {
        verificationRequired: true,
        verificationEmailSent: account.verificationEmailSent,
      },
    };
  }

  @Post('email-verification-requests')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(TrustedOriginGuard, EmailVerificationRequestGuard)
  @ApiOperation({ summary: 'Request a replacement email verification link' })
  @ApiAcceptedResponse({
    description: 'The request is accepted regardless of account existence.',
  })
  async requestVerification(
    @Body(new ZodValidationPipe(emailVerificationRequestSchema))
    body: EmailVerificationRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<unknown> {
    setPrivateResponseHeaders(response);
    await this.requestEmailVerification.execute(body.email);
    return { data: null, meta: {} };
  }

  @Post('email-verifications')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(TrustedOriginGuard, EmailVerificationConfirmationGuard)
  @ApiOperation({ summary: 'Confirm ownership of an email address' })
  @ApiNoContentResponse({ description: 'Email address verified.' })
  async confirmVerification(
    @Body(new ZodValidationPipe(emailVerificationConfirmationSchema))
    body: EmailVerificationConfirmation,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    setPrivateResponseHeaders(response);
    await this.verifyEmail.execute(body.token);
  }

  @Post('password-reset-requests')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(TrustedOriginGuard, PasswordResetRequestGuard)
  @ApiOperation({ summary: 'Request a password reset link' })
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
    body: PasswordResetRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<unknown> {
    setPrivateResponseHeaders(response);
    await this.requestPasswordReset.execute(body.email);
    return { data: null, meta: {} };
  }

  @Post('password-resets')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(TrustedOriginGuard, PasswordResetConfirmationGuard)
  @ApiOperation({ summary: 'Replace a password using a reset token' })
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
    body: PasswordResetConfirmation,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    setPrivateResponseHeaders(response);
    await this.resetPassword.execute({
      token: body.token,
      newPassword: body.newPassword,
    });
    clearSessionCookie(response, this.config);
  }

  @Put('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(TrustedOriginGuard, PasswordChangeRequestGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Change the current user password' })
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
    body: PasswordChangeRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    setPrivateResponseHeaders(response);
    const changed = await this.changePassword.execute({
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
  @UseGuards(AuthenticatedRequestContextGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Resolve the current user and trusted active workspace',
  })
  @ApiOkResponse({ description: 'Current authenticated session.' })
  currentSession(
    @CurrentAuthenticatedSession() session: CurrentSession,
  ): unknown {
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
