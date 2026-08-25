import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../../../infrastructure/infrastructure.module';
import { SESSION_STATE_REPOSITORY } from './repositories/session-state.repository';
import { SessionStateService } from './session-state.service';
import { SESSION_CACHE } from '../application/session-cache.port';
import { PrismaAuthenticationSessionsRepository } from '../infrastructure/prisma-authentication-sessions.repository';
import { SessionCache } from '../infrastructure/session-cache';

/**
 * Shares Authentication-owned durable session access and disposable cache
 * boundaries with modules that must verify or revoke membership sessions.
 */
@Module({
  imports: [InfrastructureModule],
  providers: [
    SessionStateService,
    PrismaAuthenticationSessionsRepository,
    SessionCache,
    { provide: SESSION_CACHE, useExisting: SessionCache },
    {
      provide: SESSION_STATE_REPOSITORY,
      useExisting: PrismaAuthenticationSessionsRepository,
    },
  ],
  exports: [SessionStateService],
})
export class SessionStateModule {}
