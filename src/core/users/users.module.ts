import { Module } from '@nestjs/common';
import { USERS_REPOSITORY, Users } from './application/users';
import { PrismaUsersRepository } from './infrastructure/prisma-users.repository';
import { CoreInfrastructureModule } from '../core-infrastructure.module';

@Module({
  imports: [CoreInfrastructureModule],
  providers: [
    Users,
    PrismaUsersRepository,
    { provide: USERS_REPOSITORY, useExisting: PrismaUsersRepository },
  ],
  exports: [Users],
})
export class UsersModule {}
