import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { SessionsRepository } from './sessions.repository';
import { SessionsService } from './sessions.service';

/** Owns authoritative opaque sessions without depending on tenant features. */
@Module({
  imports: [InfrastructureModule],
  providers: [SessionsService, SessionsRepository],
  exports: [SessionsService],
})
export class SessionsModule {}
