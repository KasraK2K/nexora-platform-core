import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { CoreInfrastructureModule } from '../core-infrastructure.module';
import { Clock } from '../../shared/application/clock';
import { IdentifierFactory } from '../../shared/application/identifier-factory';
import {
  AUTHENTICATION_SESSIONS_REPOSITORY,
  AuthenticationSessions,
} from './application/authentication-sessions';
import { GetCurrentSession } from './application/get-current-session.use-case';
import { PASSWORD_HASHER } from './application/password-hasher.port';
import { RegisterAccount } from './application/register-account.use-case';
import { SessionTokenService } from './application/session-token.service';
import { SESSION_CACHE } from './application/session-cache.port';
import { PasswordPolicy } from './domain/password-policy';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher';
import { PrismaAuthenticationSessionsRepository } from './infrastructure/prisma-authentication-sessions.repository';
import { RegistrationRateLimiter } from './infrastructure/registration-rate-limiter';
import { SessionCache } from './infrastructure/session-cache';
import { AuthenticationController } from './presentation/authentication.controller';
import { RegistrationRequestGuard } from './presentation/registration-request.guard';

@Module({
  imports: [
    CoreInfrastructureModule,
    IdentityModule,
    UsersModule,
    OrganizationsModule,
    WorkspacesModule,
    MembershipsModule,
    AuditModule,
  ],
  controllers: [AuthenticationController],
  providers: [
    Clock,
    IdentifierFactory,
    PasswordPolicy,
    SessionTokenService,
    SessionCache,
    RegistrationRateLimiter,
    RegistrationRequestGuard,
    RegisterAccount,
    GetCurrentSession,
    AuthenticationSessions,
    Argon2PasswordHasher,
    PrismaAuthenticationSessionsRepository,
    { provide: PASSWORD_HASHER, useExisting: Argon2PasswordHasher },
    { provide: SESSION_CACHE, useExisting: SessionCache },
    {
      provide: AUTHENTICATION_SESSIONS_REPOSITORY,
      useExisting: PrismaAuthenticationSessionsRepository,
    },
  ],
})
export class AuthenticationModule {}
