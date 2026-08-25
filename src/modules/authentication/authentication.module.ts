import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { SessionStateModule } from './session-state/session-state.module';
import { MailModule } from '../mail/mail.module';
import { Clock } from '../../common/application/clock';
import { IdentifierFactory } from '../../common/application/identifier-factory';
import { AUTHENTICATION_RATE_LIMITER } from './application/authentication-rate-limiter.port';
import { PASSWORD_COMPROMISE_CHECKER } from './application/password-compromise-checker.port';
import { PASSWORD_HASHER } from './application/password-hasher.port';
import { SessionTokenService } from './application/session-token.service';
import { PasswordPolicy } from './domain/password-policy';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher';
import { PwnedPasswordsCompromiseChecker } from './infrastructure/pwned-passwords-compromise-checker';
import { AuthenticationRateLimiter } from './infrastructure/authentication-rate-limiter';
import { RegistrationController } from './controllers/registration.controller';
import { EmailVerificationController } from './controllers/email-verification.controller';
import { PasswordController } from './controllers/password.controller';
import { SessionsController } from './controllers/sessions.controller';
import { RegistrationRequestGuard } from './guards/registration-request.guard';
import { LoginRequestGuard } from './guards/login-request.guard';
import { TrustedOriginGuard } from './guards/trusted-origin.guard';
import { EmailVerificationTokenService } from './application/email-verification-token.service';
import { EMAIL_VERIFICATIONS_REPOSITORY } from './repositories/email-verifications.repository';
import { EmailVerificationDelivery } from './application/email-verification-delivery';
import { PrismaEmailVerificationsRepository } from './infrastructure/prisma-email-verifications.repository';
import { EmailVerificationRequestGuard } from './guards/email-verification-request.guard';
import { EmailVerificationConfirmationGuard } from './guards/email-verification-confirmation.guard';
import { PasswordResetTokenService } from './application/password-reset-token.service';
import { PASSWORD_RESET_TOKENS_REPOSITORY } from './repositories/password-reset-tokens.repository';
import { PasswordResetDelivery } from './application/password-reset-delivery';
import { PrismaPasswordResetTokensRepository } from './infrastructure/prisma-password-reset-tokens.repository';
import { PasswordResetRequestGuard } from './guards/password-reset-request.guard';
import { PasswordResetConfirmationGuard } from './guards/password-reset-confirmation.guard';
import { PasswordChangeRequestGuard } from './guards/password-change-request.guard';
import { AuthenticatedRequestContextGuard } from './guards/authenticated-request-context.guard';
import { AccessibleWorkspaces } from './application/accessible-workspaces';
import { WorkspaceSwitchRequestGuard } from './guards/workspace-switch-request.guard';
import { RegistrationService } from './services/registration.service';
import { EmailVerificationService } from './services/email-verification.service';
import { PasswordService } from './services/password.service';
import { SessionsService } from './services/sessions.service';
import { AUTHENTICATION_SESSIONS_REPOSITORY } from './repositories/authentication-sessions.repository';
import { PrismaAuthenticationSessionsRepository } from './infrastructure/prisma-authentication-sessions.repository';
import { SESSION_CACHE } from './application/session-cache.port';
import { SessionCache } from './infrastructure/session-cache';
import { SessionStoreService } from './application/session-store.service';

/**
 * Composes Platform Core registration, verification, password, login, session,
 * and workspace-switching flows with their transport and infrastructure adapters.
 */
@Module({
  imports: [
    InfrastructureModule,
    SessionStateModule,
    IdentityModule,
    UsersModule,
    OrganizationsModule,
    WorkspacesModule,
    MembershipsModule,
    AuditModule,
    MailModule,
  ],
  controllers: [
    RegistrationController,
    EmailVerificationController,
    PasswordController,
    SessionsController,
  ],
  providers: [
    Clock,
    IdentifierFactory,
    PasswordPolicy,
    SessionTokenService,
    EmailVerificationTokenService,
    EmailVerificationDelivery,
    PasswordResetTokenService,
    PasswordResetDelivery,
    AuthenticationRateLimiter,
    {
      provide: AUTHENTICATION_RATE_LIMITER,
      useExisting: AuthenticationRateLimiter,
    },
    RegistrationRequestGuard,
    LoginRequestGuard,
    EmailVerificationRequestGuard,
    EmailVerificationConfirmationGuard,
    PasswordResetRequestGuard,
    PasswordResetConfirmationGuard,
    PasswordChangeRequestGuard,
    AuthenticatedRequestContextGuard,
    TrustedOriginGuard,
    WorkspaceSwitchRequestGuard,
    AccessibleWorkspaces,
    RegistrationService,
    EmailVerificationService,
    PasswordService,
    SessionsService,
    SessionStoreService,
    SessionCache,
    PrismaAuthenticationSessionsRepository,
    Argon2PasswordHasher,
    PwnedPasswordsCompromiseChecker,
    PrismaEmailVerificationsRepository,
    PrismaPasswordResetTokensRepository,
    { provide: SESSION_CACHE, useExisting: SessionCache },
    {
      provide: AUTHENTICATION_SESSIONS_REPOSITORY,
      useExisting: PrismaAuthenticationSessionsRepository,
    },
    { provide: PASSWORD_HASHER, useExisting: Argon2PasswordHasher },
    {
      provide: PASSWORD_COMPROMISE_CHECKER,
      useExisting: PwnedPasswordsCompromiseChecker,
    },
    {
      provide: EMAIL_VERIFICATIONS_REPOSITORY,
      useExisting: PrismaEmailVerificationsRepository,
    },
    {
      provide: PASSWORD_RESET_TOKENS_REPOSITORY,
      useExisting: PrismaPasswordResetTokensRepository,
    },
  ],
  exports: [AuthenticatedRequestContextGuard, TrustedOriginGuard],
})
export class AuthenticationModule {}
