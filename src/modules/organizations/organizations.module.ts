import { Module } from '@nestjs/common';
import { PrismaOrganizationsRepository } from './infrastructure/prisma-organizations.repository';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { OrganizationsService } from './organizations.service';
import { ORGANIZATIONS_REPOSITORY } from './repositories/organizations.repository';

/** Wires the public OrganizationsService facade to its Prisma storage adapter. */
@Module({
  imports: [InfrastructureModule],
  providers: [
    OrganizationsService,
    PrismaOrganizationsRepository,
    {
      provide: ORGANIZATIONS_REPOSITORY,
      useExisting: PrismaOrganizationsRepository,
    },
  ],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
