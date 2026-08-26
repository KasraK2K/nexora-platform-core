import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../../../infrastructure/infrastructure.module';
import { SessionStateRepository } from './session-state.repository';
import { SessionStateService } from './session-state.service';
import { SESSION_CACHE } from '../cache/session-cache';
import { SessionCache } from '../cache/redis-session-cache';

/**
 * Shares Authentication-owned durable session access and disposable cache
 * boundaries with modules that must verify or revoke membership sessions.
 */
@Module({
  imports: [InfrastructureModule],
  providers: [
    SessionStateService,
    SessionStateRepository,
    SessionCache,
    { provide: SESSION_CACHE, useExisting: SessionCache },
  ],
  exports: [SessionStateService],
})
export class SessionStateModule {}
