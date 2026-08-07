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
import { AUTHENTICATION_RATE_LIMITER } from './application/authentication-rate-limiter.port';
import { CreateSession } from './application/create-session.use-case';
import { RevokeAllSessions } from './application/revoke-all-sessions.use-case';
import { RevokeCurrentSession } from './application/revoke-current-session.use-case';
import { PASSWORD_COMPROMISE_CHECKER } from './application/password-compromise-checker.port';
import { PASSWORD_HASHER } from './application/password-hasher.port';
import { RegisterAccount } from './application/register-account.use-case';
import { SessionTokenService } from './application/session-token.service';
import { SESSION_CACHE } from './application/session-cache.port';
import { PasswordPolicy } from './domain/password-policy';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher';
import { PrismaAuthenticationSessionsRepository } from './infrastructure/prisma-authentication-sessions.repository';
import { PwnedPasswordsCompromiseChecker } from './infrastructure/pwned-passwords-compromise-checker';
import { AuthenticationRateLimiter } from './infrastructure/authentication-rate-limiter';
import { SessionCache } from './infrastructure/session-cache';
import { AuthenticationController } from './presentation/authentication.controller';
import { RegistrationRequestGuard } from './presentation/registration-request.guard';
import { LoginRequestGuard } from './presentation/login-request.guard';
import { TrustedOriginGuard } from './presentation/trusted-origin.guard';

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
    AuthenticationRateLimiter,
    {
      provide: AUTHENTICATION_RATE_LIMITER,
      useExisting: AuthenticationRateLimiter,
    },
    RegistrationRequestGuard,
    LoginRequestGuard,
    TrustedOriginGuard,
    RegisterAccount,
    CreateSession,
    GetCurrentSession,
    RevokeCurrentSession,
    RevokeAllSessions,
    AuthenticationSessions,
    Argon2PasswordHasher,
    PwnedPasswordsCompromiseChecker,
    PrismaAuthenticationSessionsRepository,
    { provide: PASSWORD_HASHER, useExisting: Argon2PasswordHasher },
    {
      provide: PASSWORD_COMPROMISE_CHECKER,
      useExisting: PwnedPasswordsCompromiseChecker,
    },
    { provide: SESSION_CACHE, useExisting: SessionCache },
    {
      provide: AUTHENTICATION_SESSIONS_REPOSITORY,
      useExisting: PrismaAuthenticationSessionsRepository,
    },
  ],
})
export class AuthenticationModule {}
