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
import { EMAIL_VERIFICATION_SENDER } from './application/email-verification-sender.port';
import { EmailVerificationTokenService } from './application/email-verification-token.service';
import {
  EMAIL_VERIFICATIONS_REPOSITORY,
  EmailVerifications,
} from './application/email-verifications';
import { EmailVerificationDelivery } from './application/email-verification-delivery';
import { RequestEmailVerification } from './application/request-email-verification.use-case';
import { VerifyEmail } from './application/verify-email.use-case';
import { PrismaEmailVerificationsRepository } from './infrastructure/prisma-email-verifications.repository';
import { SmtpEmailVerificationSender } from './infrastructure/smtp-email-verification.sender';
import { EmailVerificationRequestGuard } from './presentation/email-verification-request.guard';
import { EmailVerificationConfirmationGuard } from './presentation/email-verification-confirmation.guard';

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
    EmailVerificationTokenService,
    EmailVerifications,
    EmailVerificationDelivery,
    SessionCache,
    AuthenticationRateLimiter,
    {
      provide: AUTHENTICATION_RATE_LIMITER,
      useExisting: AuthenticationRateLimiter,
    },
    RegistrationRequestGuard,
    LoginRequestGuard,
    EmailVerificationRequestGuard,
    EmailVerificationConfirmationGuard,
    TrustedOriginGuard,
    RegisterAccount,
    CreateSession,
    GetCurrentSession,
    RevokeCurrentSession,
    RevokeAllSessions,
    RequestEmailVerification,
    VerifyEmail,
    AuthenticationSessions,
    Argon2PasswordHasher,
    PwnedPasswordsCompromiseChecker,
    PrismaAuthenticationSessionsRepository,
    PrismaEmailVerificationsRepository,
    SmtpEmailVerificationSender,
    { provide: PASSWORD_HASHER, useExisting: Argon2PasswordHasher },
    {
      provide: PASSWORD_COMPROMISE_CHECKER,
      useExisting: PwnedPasswordsCompromiseChecker,
    },
    { provide: SESSION_CACHE, useExisting: SessionCache },
    {
      provide: EMAIL_VERIFICATION_SENDER,
      useExisting: SmtpEmailVerificationSender,
    },
    {
      provide: EMAIL_VERIFICATIONS_REPOSITORY,
      useExisting: PrismaEmailVerificationsRepository,
    },
    {
      provide: AUTHENTICATION_SESSIONS_REPOSITORY,
      useExisting: PrismaAuthenticationSessionsRepository,
    },
  ],
})
export class AuthenticationModule {}
