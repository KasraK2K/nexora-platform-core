import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import {
  IdentityAlreadyExistsError,
  IdentityService,
} from '../../identity/identity.service';
import { MembershipsService } from '../../memberships/memberships.service';
import { OrganizationsService } from '../../organizations/organizations.service';
import { UsersService } from '../../users/users.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { AppConfig } from '../../../config/app-config';
import { Clock } from '../../../common/clock';
import { IdentifierFactory } from '../../../common/identifier-factory';
import { TRANSACTION_MANAGER } from '../../../common/transaction-manager';
import type { TransactionManager } from '../../../common/transaction-manager';
import { PasswordPolicy } from '../security/password-policy';
import {
  EmailAlreadyRegisteredError,
  InvalidRegistrationError,
  RegistrationUnavailableError,
} from '../errors/authentication.errors';
import { PASSWORD_COMPROMISE_CHECKER } from '../security/password-compromise-checker';
import type { PasswordCompromiseChecker } from '../security/password-compromise-checker';
import { PASSWORD_HASHER } from '../security/password-hasher';
import type { PasswordHasher } from '../security/password-hasher';
import { OpaqueTokenService } from '../../../common/security/opaque-token.service';
import { EmailVerificationDeliveryService } from '../mail/email-verification-delivery.service';
import { EmailVerificationsRepository } from '../repositories/email-verifications.repository';
import { SessionStoreService } from '../services/session-store.service';

/** Validated onboarding data for the default Platform Core registration policy. */
export type RegisterAccountCommand = {
  email: string;
  password: string;
  displayName: string;
  organizationName: string;
  workspaceName: string;
};

/** IDs, pending status, and session secret produced by successful onboarding. */
export type RegisteredAccount = {
  userId: string;
  organizationId: string;
  workspaceId: string;
  displayName: string;
  organizationName: string;
  workspaceName: string;
  sessionToken: string;
  sessionExpiresAt: Date;
  status: 'PENDING_VERIFICATION';
  verificationEmailSent: boolean;
};

/** Owns the default account, workspace, verification, and session transaction. */
@Injectable()
export class RegistrationService {
  private readonly logger = new Logger('RegisterAccount');

  constructor(
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(PASSWORD_COMPROMISE_CHECKER)
    private readonly passwordCompromiseChecker: PasswordCompromiseChecker,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
    private readonly identities: IdentityService,
    private readonly users: UsersService,
    private readonly organizations: OrganizationsService,
    private readonly workspaces: WorkspacesService,
    private readonly memberships: MembershipsService,
    private readonly sessions: SessionStoreService,
    private readonly auditLog: AuditService,
    private readonly emailVerifications: EmailVerificationsRepository,
    private readonly passwordPolicy: PasswordPolicy,
    private readonly tokens: OpaqueTokenService,
    private readonly verificationDelivery: EmailVerificationDeliveryService,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
    private readonly config: AppConfig,
  ) {}

  /** Creates the initial account graph and returns the new opaque session. */
  async register(command: RegisterAccountCommand): Promise<RegisteredAccount> {
    const normalizedEmail = command.email.trim().toLocaleLowerCase('en-US');
    const password = this.passwordPolicy.validateAndNormalize(command.password);
    let passwordIsCompromised: boolean;
    try {
      passwordIsCompromised =
        await this.passwordCompromiseChecker.isCompromised(password);
    } catch {
      throw new RegistrationUnavailableError();
    }
    if (passwordIsCompromised) {
      throw new InvalidRegistrationError(
        'Choose a password that has not appeared in common-password or breach data.',
      );
    }

    const session = this.tokens.create();
    const sessionExpiresAt = new Date(
      this.clock.now().getTime() + this.config.sessionTtlSeconds * 1000,
    );
    const verification = this.tokens.create();
    const verificationId = this.identifiers.create();
    const verificationExpiresAt = new Date(
      this.clock.now().getTime() +
        this.config.emailVerificationTtlSeconds * 1000,
    );
    let passwordHash: string;
    try {
      passwordHash = await this.passwordHasher.hash(password);
    } catch {
      throw new RegistrationUnavailableError();
    }

    const userId = this.identifiers.create();
    const organizationId = this.identifiers.create();
    const workspaceId = this.identifiers.create();
    try {
      await this.transactions.execute(async () => {
        const identityId = this.identifiers.create();
        await this.identities.createPasswordIdentity({
          identityId,
          normalizedEmail,
          passwordHash,
        });
        await this.users.create({
          id: userId,
          identityId,
          displayName: command.displayName,
          status: 'PENDING_VERIFICATION',
        });
        await this.organizations.create({
          id: organizationId,
          ownerUserId: userId,
          name: command.organizationName,
        });
        await this.workspaces.create({
          id: workspaceId,
          organizationId,
          name: command.workspaceName,
        });
        await this.memberships.createOwner({
          id: this.identifiers.create(),
          workspaceId,
          userId,
        });
        await this.emailVerifications.create({
          id: verificationId,
          userId,
          workspaceId,
          tokenHash: verification.hash,
          expiresAt: verificationExpiresAt,
        });
        await this.verificationDelivery.enqueue({
          verificationId,
          workspaceId,
          email: normalizedEmail,
          token: verification.raw,
          expiresAt: verificationExpiresAt,
        });
        await this.sessions.create({
          id: this.identifiers.create(),
          tokenHash: session.hash,
          userId,
          activeWorkspaceId: workspaceId,
          expiresAt: sessionExpiresAt,
        });
        await this.auditLog.append({
          id: this.identifiers.create(),
          workspaceId,
          actorUserId: userId,
          action: 'account.registered',
          resourceId: userId,
        });
        await this.auditLog.append({
          id: this.identifiers.create(),
          workspaceId,
          actorUserId: userId,
          action: 'email.verification.requested',
          resourceId: verificationId,
        });
      });
    } catch (error) {
      if (error instanceof IdentityAlreadyExistsError)
        throw new EmailAlreadyRegisteredError();
      this.logger.error(
        JSON.stringify({
          event: 'registration.transaction_failed',
          errorType: error instanceof Error ? error.name : 'UnknownError',
          errorCode: readSafeErrorCode(error),
        }),
      );
      throw new RegistrationUnavailableError();
    }

    await this.sessions.storeCacheBestEffort(
      session.hash,
      { userId, workspaceId },
      sessionExpiresAt,
    );
    const verificationEmailSent =
      await this.verificationDelivery.attempt(verificationId);
    return {
      userId,
      organizationId,
      workspaceId,
      displayName: command.displayName,
      organizationName: command.organizationName,
      workspaceName: command.workspaceName,
      sessionToken: session.raw,
      sessionExpiresAt,
      status: 'PENDING_VERIFICATION',
      verificationEmailSent,
    };
  }
}

/** Extracts only a string error code that is safe for structured logs. */
function readSafeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error))
    return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}
