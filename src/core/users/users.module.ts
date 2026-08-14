import { Module } from '@nestjs/common';
import { USERS_REPOSITORY, Users } from './application/users';
import { PrismaUsersRepository } from './infrastructure/prisma-users.repository';
import { CoreInfrastructureModule } from '../core-infrastructure.module';
import { AuthenticationSessionStateModule } from '../authentication/authentication-session-state.module';
import { AuditModule } from '../audit/audit.module';
import { Clock } from '../../shared/application/clock';
import { IdentifierFactory } from '../../shared/application/identifier-factory';
import { UpdateOwnProfile } from './application/update-own-profile.use-case';
import { UsersController } from './presentation/users.controller';

/** Wires the Users public facade and authenticated self-profile endpoint. */
@Module({
  imports: [
    CoreInfrastructureModule,
    AuthenticationSessionStateModule,
    AuditModule,
  ],
  controllers: [UsersController],
  providers: [
    Clock,
    IdentifierFactory,
    Users,
    UpdateOwnProfile,
    PrismaUsersRepository,
    { provide: USERS_REPOSITORY, useExisting: PrismaUsersRepository },
  ],
  exports: [Users],
})
export class UsersModule {}
