import { Controller, Get } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedRoute } from '../../authorization/decorators/route-admission.decorator';
import { CurrentAuthenticatedSession } from '../decorators/authenticated-request-context.decorator';
import type { CurrentSession } from '../services/session-context.service';

/** HTTP adapter for the already-resolved current session view. */
@ApiTags('Authentication')
@Controller('v1/auth')
export class SessionContextController {
  /** Returns the session view resolved by the route-admission guards. */
  @Get('session')
  @AuthenticatedRoute({ allowPendingVerification: true })
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
}
