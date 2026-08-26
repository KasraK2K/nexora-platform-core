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
import { Clock } from '../../common/clock';
import { IdentifierFactory } from '../../common/identifier-factory';
import { PASSWORD_COMPROMISE_CHECKER } from './security/password-compromise-checker';
import { PASSWORD_HASHER } from './security/password-hasher';
import { OpaqueTokenService } from '../../common/security/opaque-token.service';
import { PasswordPolicy } from './security/password-policy';
import { Argon2PasswordHasher } from './security/argon2-password-hasher';
import { PwnedPasswordsCompromiseChecker } from './security/pwned-passwords-compromise-checker';
import { AuthenticationRateLimiter } from './rate-limit/redis-authentication-rate-limiter';
import { RegistrationController } from './controllers/registration.controller';
import { EmailVerificationController } from './controllers/email-verification.controller';
import { PasswordChangeController } from './controllers/password-change.controller';
import { PasswordResetController } from './controllers/password-reset.controller';
import { SessionContextController } from './controllers/session-context.controller';
import { SessionLoginController } from './controllers/session-login.controller';
import { SessionManagementController } from './controllers/session-management.controller';
import { WorkspaceSessionController } from './controllers/workspace-session.controller';
import { RegistrationRequestGuard } from './guards/registration-request.guard';
import { LoginRequestGuard } from './guards/login-request.guard';
import { TrustedOriginGuard } from './guards/trusted-origin.guard';
import { EmailVerificationsRepository } from './repositories/email-verifications.repository';
import { EmailVerificationDeliveryService } from './mail/email-verification-delivery.service';
import { EmailVerificationRequestGuard } from './guards/email-verification-request.guard';
import { EmailVerificationConfirmationGuard } from './guards/email-verification-confirmation.guard';
import { PasswordResetTokensRepository } from './repositories/password-reset-tokens.repository';
import { PasswordResetDeliveryService } from './mail/password-reset-delivery.service';
import { PasswordResetRequestGuard } from './guards/password-reset-request.guard';
import { PasswordResetConfirmationGuard } from './guards/password-reset-confirmation.guard';
import { PasswordChangeRequestGuard } from './guards/password-change-request.guard';
import { AuthenticatedRequestContextGuard } from './guards/authenticated-request-context.guard';
import { AccessibleWorkspacesService } from './services/accessible-workspaces.service';
import { WorkspaceSwitchRequestGuard } from './guards/workspace-switch-request.guard';
import { RegistrationService } from './services/registration.service';
import { EmailVerificationService } from './services/email-verification.service';
import { PasswordChangeService } from './services/password-change.service';
import { PasswordResetService } from './services/password-reset.service';
import { SessionContextService } from './services/session-context.service';
import { SessionLoginService } from './services/session-login.service';
import { SessionManagementService } from './services/session-management.service';
import { WorkspaceSessionService } from './services/workspace-session.service';
import { AuthenticationSessionsRepository } from './repositories/authentication-sessions.repository';
import { SESSION_CACHE } from './cache/session-cache';
import { SessionCache } from './cache/redis-session-cache';
import { SessionStoreService } from './services/session-store.service';

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
    PasswordResetController,
    PasswordChangeController,
    SessionLoginController,
    SessionContextController,
    WorkspaceSessionController,
    SessionManagementController,
  ],
  providers: [
    Clock,
    IdentifierFactory,
    PasswordPolicy,
    OpaqueTokenService,
    EmailVerificationDeliveryService,
    PasswordResetDeliveryService,
    AuthenticationRateLimiter,
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
    AccessibleWorkspacesService,
    RegistrationService,
    EmailVerificationService,
    PasswordResetService,
    PasswordChangeService,
    SessionLoginService,
    SessionContextService,
    WorkspaceSessionService,
    SessionManagementService,
    SessionStoreService,
    SessionCache,
    AuthenticationSessionsRepository,
    Argon2PasswordHasher,
    PwnedPasswordsCompromiseChecker,
    EmailVerificationsRepository,
    PasswordResetTokensRepository,
    { provide: SESSION_CACHE, useExisting: SessionCache },
    { provide: PASSWORD_HASHER, useExisting: Argon2PasswordHasher },
    {
      provide: PASSWORD_COMPROMISE_CHECKER,
      useExisting: PwnedPasswordsCompromiseChecker,
    },
  ],
  exports: [AuthenticatedRequestContextGuard, TrustedOriginGuard],
})
export class AuthenticationModule {}
