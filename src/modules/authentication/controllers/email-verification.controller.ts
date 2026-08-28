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
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe';
import { PublicRoute } from '../../authorization/route-admission.decorator';
import {
  emailVerificationConfirmationSchema,
  emailVerificationRequestSchema,
  type EmailVerificationConfirmationDto,
  type EmailVerificationRequestDto,
} from '../dto/email-verification.dto';
import { EmailVerificationConfirmationGuard } from '../guards/email-verification-confirmation.guard';
import { EmailVerificationRequestGuard } from '../guards/email-verification-request.guard';
import { setPrivateResponseHeaders } from '../../../common/http/private-response-headers';
import { EmailVerificationService } from '../services/email-verification.service';

/** HTTP adapter for replacement-link requests and email confirmation. */
@ApiTags('Authentication')
@Controller('v1/auth')
export class EmailVerificationController {
  constructor(private readonly emailVerification: EmailVerificationService) {}

  /** Accepts a replacement-link request with an enumeration-resistant response. */
  @Post('email-verification-requests')
  @HttpCode(HttpStatus.ACCEPTED)
  @PublicRoute({ requireTrustedOrigin: true })
  @UseGuards(EmailVerificationRequestGuard)
  @ApiOperation({
    summary: 'Request a replacement email verification link',
  })
  @ApiAcceptedResponse({
    description: 'The request is accepted regardless of account existence.',
  })
  async requestVerification(
    @Body(new ZodValidationPipe(emailVerificationRequestSchema))
    body: EmailVerificationRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<unknown> {
    setPrivateResponseHeaders(response);
    await this.emailVerification.request(body.email);
    return { data: null, meta: {} };
  }

  /** Consumes a single-use verification token and activates the account. */
  @Post('email-verifications')
  @HttpCode(HttpStatus.NO_CONTENT)
  @PublicRoute({ requireTrustedOrigin: true })
  @UseGuards(EmailVerificationConfirmationGuard)
  @ApiOperation({
    summary: 'Confirm ownership of an email address',
  })
  @ApiNoContentResponse({ description: 'Email address verified.' })
  async confirmVerification(
    @Body(new ZodValidationPipe(emailVerificationConfirmationSchema))
    body: EmailVerificationConfirmationDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    setPrivateResponseHeaders(response);
    await this.emailVerification.confirm(body.token);
  }
}
