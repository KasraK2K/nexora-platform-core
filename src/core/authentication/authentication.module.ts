import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { CoreInfrastructureModule } from '../core-infrastructure.module';
import { AuthenticationSessionStateModule } from './authentication-session-state.module';
import { MailModule } from '../mail/mail.module';
import { Clock } from '../../shared/application/clock';
import { IdentifierFactory } from '../../shared/application/identifier-factory';
import { GetCurrentSession } from './application/get-current-session.use-case';
import { AUTHENTICATION_RATE_LIMITER } from './application/authentication-rate-limiter.port';
import { CreateSession } from './application/create-session.use-case';
import { RevokeAllSessions } from './application/revoke-all-sessions.use-case';
import { RevokeCurrentSession } from './application/revoke-current-session.use-case';
import { PASSWORD_COMPROMISE_CHECKER } from './application/password-compromise-checker.port';
import { PASSWORD_HASHER } from './application/password-hasher.port';
import { RegisterAccount } from './application/register-account.use-case';
import { SessionTokenService } from './application/session-token.service';
import { PasswordPolicy } from './domain/password-policy';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher';
import { PwnedPasswordsCompromiseChecker } from './infrastructure/pwned-passwords-compromise-checker';
import { AuthenticationRateLimiter } from './infrastructure/authentication-rate-limiter';
import { AuthenticationController } from './presentation/authentication.controller';
import { RegistrationRequestGuard } from './presentation/registration-request.guard';
import { LoginRequestGuard } from './presentation/login-request.guard';
import { TrustedOriginGuard } from './presentation/trusted-origin.guard';
import { EmailVerificationTokenService } from './application/email-verification-token.service';
import {
  EMAIL_VERIFICATIONS_REPOSITORY,
  EmailVerifications,
} from './application/email-verifications';
import { EmailVerificationDelivery } from './application/email-verification-delivery';
import { RequestEmailVerification } from './application/request-email-verification.use-case';
import { VerifyEmail } from './application/verify-email.use-case';
import { PrismaEmailVerificationsRepository } from './infrastructure/prisma-email-verifications.repository';
import { EmailVerificationRequestGuard } from './presentation/email-verification-request.guard';
import { EmailVerificationConfirmationGuard } from './presentation/email-verification-confirmation.guard';
import { PasswordResetTokenService } from './application/password-reset-token.service';
import {
  PASSWORD_RESET_TOKENS_REPOSITORY,
  PasswordResetTokens,
} from './application/password-reset-tokens';
import { PasswordResetDelivery } from './application/password-reset-delivery';
import { RequestPasswordReset } from './application/request-password-reset.use-case';
import { ResetPassword } from './application/reset-password.use-case';
import { PrismaPasswordResetTokensRepository } from './infrastructure/prisma-password-reset-tokens.repository';
import { PasswordResetRequestGuard } from './presentation/password-reset-request.guard';
import { PasswordResetConfirmationGuard } from './presentation/password-reset-confirmation.guard';
import { ChangePassword } from './application/change-password.use-case';
import { PasswordChangeRequestGuard } from './presentation/password-change-request.guard';
import { AuthenticatedRequestContextGuard } from './presentation/authenticated-request-context.guard';
import { AccessibleWorkspaces } from './application/accessible-workspaces';
import { ListSessionWorkspaces } from './application/list-session-workspaces.use-case';
import { SwitchWorkspace } from './application/switch-workspace.use-case';
import { WorkspaceSwitchRequestGuard } from './presentation/workspace-switch-request.guard';

/**
 * Composes Platform Core registration, verification, password, login, session,
 * and workspace-switching flows with their transport and infrastructure adapters.
 */
@Module({
  imports: [
    CoreInfrastructureModule,
    AuthenticationSessionStateModule,
    IdentityModule,
    UsersModule,
    OrganizationsModule,
    WorkspacesModule,
    MembershipsModule,
    AuditModule,
    MailModule,
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
    PasswordResetTokenService,
    PasswordResetTokens,
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
    RegisterAccount,
    CreateSession,
    GetCurrentSession,
    RevokeCurrentSession,
    RevokeAllSessions,
    RequestEmailVerification,
    VerifyEmail,
    RequestPasswordReset,
    ResetPassword,
    ChangePassword,
    ListSessionWorkspaces,
    SwitchWorkspace,
    Argon2PasswordHasher,
    PwnedPasswordsCompromiseChecker,
    PrismaEmailVerificationsRepository,
    PrismaPasswordResetTokensRepository,
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
