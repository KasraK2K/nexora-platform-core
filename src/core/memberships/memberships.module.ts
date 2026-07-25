import { Module } from '@nestjs/common';
import { MEMBERSHIPS_REPOSITORY, Memberships } from './application/memberships';
import { PrismaMembershipsRepository } from './infrastructure/prisma-memberships.repository';
import { CoreInfrastructureModule } from '../core-infrastructure.module';

@Module({
  imports: [CoreInfrastructureModule],
  providers: [
    Memberships,
    PrismaMembershipsRepository,
    {
      provide: MEMBERSHIPS_REPOSITORY,
      useExisting: PrismaMembershipsRepository,
    },
  ],
  exports: [Memberships],
})
export class MembershipsModule {}
