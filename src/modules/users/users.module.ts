import { Module } from '@nestjs/common';
import { PrismaUsersRepository } from './infrastructure/prisma-users.repository';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { SessionStateModule } from '../authentication/session-state/session-state.module';
import { AuditModule } from '../audit/audit.module';
import { Clock } from '../../common/application/clock';
import { IdentifierFactory } from '../../common/application/identifier-factory';
import { USERS_REPOSITORY } from './repositories/users.repository';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/** Wires the UsersService public facade and authenticated self-profile endpoint. */
@Module({
  imports: [InfrastructureModule, SessionStateModule, AuditModule],
  controllers: [UsersController],
  providers: [
    Clock,
    IdentifierFactory,
    UsersService,
    PrismaUsersRepository,
    { provide: USERS_REPOSITORY, useExisting: PrismaUsersRepository },
  ],
  exports: [UsersService],
})
export class UsersModule {}
