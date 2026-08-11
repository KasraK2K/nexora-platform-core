import { Module } from '@nestjs/common';
import { WORKSPACES_REPOSITORY, Workspaces } from './application/workspaces';
import { PrismaWorkspacesRepository } from './infrastructure/prisma-workspaces.repository';
import { CoreInfrastructureModule } from '../core-infrastructure.module';
import { AuthenticationSessionStateModule } from '../authentication/authentication-session-state.module';
import { AuditModule } from '../audit/audit.module';
import { AuthorizationPolicyModule } from '../authorization/authorization-policy.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { Clock } from '../../shared/application/clock';
import { IdentifierFactory } from '../../shared/application/identifier-factory';
import { RenameCurrentWorkspace } from './application/rename-current-workspace.use-case';
import { WorkspacesController } from './presentation/workspaces.controller';

@Module({
  imports: [
    CoreInfrastructureModule,
    AuthenticationSessionStateModule,
    AuditModule,
    AuthorizationPolicyModule,
    MembershipsModule,
  ],
  controllers: [WorkspacesController],
  providers: [
    Clock,
    IdentifierFactory,
    Workspaces,
    RenameCurrentWorkspace,
    PrismaWorkspacesRepository,
    { provide: WORKSPACES_REPOSITORY, useExisting: PrismaWorkspacesRepository },
  ],
  exports: [Workspaces],
})
export class WorkspacesModule {}
