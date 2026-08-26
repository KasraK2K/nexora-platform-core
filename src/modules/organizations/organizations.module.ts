import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { OrganizationsService } from './organizations.service';
import { OrganizationsRepository } from './organizations.repository';

/** Wires the public OrganizationsService facade to its Prisma storage adapter. */
@Module({
  imports: [InfrastructureModule],
  providers: [OrganizationsService, OrganizationsRepository],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
