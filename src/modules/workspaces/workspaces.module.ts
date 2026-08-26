import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { SessionStateModule } from '../authentication/session-state/session-state.module';
import { AuditModule } from '../audit/audit.module';
import { AuthorizationPolicyModule } from '../authorization/policy/authorization-policy.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { Clock } from '../../common/clock';
import { IdentifierFactory } from '../../common/identifier-factory';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesRepository } from './workspaces.repository';
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
    WorkspacesRepository,
  ],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
