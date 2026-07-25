import { Module } from '@nestjs/common';
import { WORKSPACES_REPOSITORY, Workspaces } from './application/workspaces';
import { PrismaWorkspacesRepository } from './infrastructure/prisma-workspaces.repository';
import { CoreInfrastructureModule } from '../core-infrastructure.module';

@Module({
  imports: [CoreInfrastructureModule],
  providers: [
    Workspaces,
    PrismaWorkspacesRepository,
    { provide: WORKSPACES_REPOSITORY, useExisting: PrismaWorkspacesRepository },
  ],
  exports: [Workspaces],
})
export class WorkspacesModule {}
