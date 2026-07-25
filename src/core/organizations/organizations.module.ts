import { Module } from '@nestjs/common';
import {
  ORGANIZATIONS_REPOSITORY,
  Organizations,
} from './application/organizations';
import { PrismaOrganizationsRepository } from './infrastructure/prisma-organizations.repository';
import { CoreInfrastructureModule } from '../core-infrastructure.module';

@Module({
  imports: [CoreInfrastructureModule],
  providers: [
    Organizations,
    PrismaOrganizationsRepository,
    {
      provide: ORGANIZATIONS_REPOSITORY,
      useExisting: PrismaOrganizationsRepository,
    },
  ],
  exports: [Organizations],
})
export class OrganizationsModule {}
