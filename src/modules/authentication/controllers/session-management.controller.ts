import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { setPrivateResponseHeaders } from '../../../common/http/private-response-headers';
import {
  clearSessionCookie,
  readCookie,
} from '../../../common/http/session-cookie';
import { AppConfig } from '../../../config/app-config';
import {
  ApplicationAuthenticatedRoute,
  PublicRoute,
} from '../../authorization/route-admission.decorator';
import { SessionManagementService } from '../services/session-management.service';

/** HTTP adapter for current and all-session revocation. */
@ApiTags('Authentication')
@Controller('v1/auth')
export class SessionManagementController {
  constructor(
    private readonly sessionManagement: SessionManagementService,
    private readonly config: AppConfig,
  ) {}

  /** Idempotently revokes the presented session and clears its cookie. */
  @Delete('session')
  @HttpCode(HttpStatus.NO_CONTENT)
  @PublicRoute({ requireTrustedOrigin: true })
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Revoke the current session',
  })
  @ApiNoContentResponse({ description: 'Current session revoked.' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    setPrivateResponseHeaders(response);
    await this.sessionManagement.revokeCurrent(
      readCookie(request.header('cookie'), this.config.sessionCookieName),
    );
    this.clearCookie(response);
  }

  /** Revokes every session for the authenticated user and clears this cookie. */
  @Delete('sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApplicationAuthenticatedRoute({ requireTrustedOrigin: true })
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Revoke every session for the current user',
  })
  @ApiNoContentResponse({ description: 'All user sessions revoked.' })
  async logoutEverywhere(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    setPrivateResponseHeaders(response);
    await this.sessionManagement.revokeAll(
      readCookie(request.header('cookie'), this.config.sessionCookieName),
    );
    this.clearCookie(response);
  }

  /** Expires the configured session cookie without changing server state. */
  private clearCookie(response: Response): void {
    clearSessionCookie(response, this.config);
  }
}
