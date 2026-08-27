import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { SessionsModule } from '../sessions/sessions.module';
import { AuditModule } from '../audit/audit.module';
import { Clock } from '../../common/clock';
import { IdentifierFactory } from '../../common/identifier-factory';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

/** Wires the UsersService public facade and authenticated self-profile endpoint. */
@Module({
  imports: [InfrastructureModule, SessionsModule, AuditModule],
  controllers: [UsersController],
  providers: [Clock, IdentifierFactory, UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
