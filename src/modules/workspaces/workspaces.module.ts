import { Module } from '@nestjs/common';
import { PrismaWorkspacesRepository } from './infrastructure/prisma-workspaces.repository';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { SessionStateModule } from '../authentication/session-state/session-state.module';
import { AuditModule } from '../audit/audit.module';
import { AuthorizationPolicyModule } from '../authorization/policy/authorization-policy.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { Clock } from '../../common/application/clock';
import { IdentifierFactory } from '../../common/application/identifier-factory';
import { WORKSPACES_REPOSITORY } from './repositories/workspaces.repository';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

/** Wires Workspace persistence, policy dependencies, and tenant HTTP routes. */
@Module({
  imports: [
    InfrastructureModule,
    SessionStateModule,
    AuditModule,
    AuthorizationPolicyModule,
    MembershipsModule,
  ],
  controllers: [WorkspacesController],
  providers: [
    Clock,
    IdentifierFactory,
    WorkspacesService,
    PrismaWorkspacesRepository,
    { provide: WORKSPACES_REPOSITORY, useExisting: PrismaWorkspacesRepository },
  ],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
