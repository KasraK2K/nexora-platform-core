import { Body, Controller, Patch } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedRequestContext } from '../../authentication/application/authenticated-request-context';
import { CurrentAuthenticatedContext } from '../../authentication/presentation/authenticated-request-context';
import { AuthenticatedRoute } from '../../authorization/presentation/route-admission';
import { ZodValidationPipe } from '../../../shared/presentation/zod-validation.pipe';
import { UpdateOwnProfile } from '../application/update-own-profile.use-case';
import {
  updateOwnProfileSchema,
  type UpdateOwnProfileRequest,
} from './user-lifecycle.contract';

@ApiTags('Users')
@Controller('v1/users')
export class UsersController {
  constructor(private readonly updateOwnProfile: UpdateOwnProfile) {}

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
    body: UpdateOwnProfileRequest,
    @CurrentAuthenticatedContext() context: AuthenticatedRequestContext,
  ): Promise<unknown> {
    return {
      data: await this.updateOwnProfile.execute({
        sessionId: context.sessionId,
        actorUserId: context.actorUserId,
        workspaceId: context.workspaceId,
        displayName: body.displayName,
      }),
      meta: {},
    };
  }
}
