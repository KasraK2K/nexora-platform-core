import { Body, Controller, Patch } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentAuthenticatedContext,
  type AuthenticatedRequestContext,
} from '../authentication/decorators/authenticated-request-context.decorator';
import { AuthenticatedRoute } from '../authorization/decorators/route-admission.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import {
  updateOwnProfileSchema,
  type UpdateOwnProfileDto,
} from './dto/update-own-profile.dto';
import { UsersService } from './users.service';

/** HTTP adapter for authenticated self-service user operations. */
@ApiTags('Users')
@Controller('v1/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Validates and maps the trusted actor's profile update. */
  @Patch('me')
  @AuthenticatedRoute({ requireTrustedOrigin: true })
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Update the current user profile' })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['displayName'],
      properties: {
        displayName: { type: 'string', minLength: 1, maxLength: 100 },
      },
    },
  })
  @ApiOkResponse({ description: 'Current user profile updated or unchanged.' })
  async updateMe(
    @Body(new ZodValidationPipe(updateOwnProfileSchema))
    body: UpdateOwnProfileDto,
    @CurrentAuthenticatedContext() context: AuthenticatedRequestContext,
  ): Promise<unknown> {
    return {
      data: await this.users.updateOwnProfile({
        sessionId: context.sessionId,
        actorUserId: context.actorUserId,
        workspaceId: context.workspaceId,
        displayName: body.displayName,
      }),
      meta: {},
    };
  }
}
