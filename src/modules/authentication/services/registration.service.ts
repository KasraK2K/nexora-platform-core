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
import { Clock } from '../../../common/application/clock';
import { IdentifierFactory } from '../../../common/application/identifier-factory';
import { TRANSACTION_MANAGER } from '../../../common/application/transaction-manager.port';
import type { TransactionManager } from '../../../common/application/transaction-manager.port';
import { PasswordPolicy } from '../domain/password-policy';
import {
  EmailAlreadyRegisteredError,
  InvalidRegistrationError,
  RegistrationUnavailableError,
} from '../domain/registration.errors';
import { PASSWORD_COMPROMISE_CHECKER } from '../application/password-compromise-checker.port';
import type { PasswordCompromiseChecker } from '../application/password-compromise-checker.port';
import { PASSWORD_HASHER } from '../application/password-hasher.port';
import type { PasswordHasher } from '../application/password-hasher.port';
import { SessionTokenService } from '../application/session-token.service';
import { EmailVerificationDelivery } from '../application/email-verification-delivery';
import { EmailVerificationTokenService } from '../application/email-verification-token.service';
import {
  EMAIL_VERIFICATIONS_REPOSITORY,
  type EmailVerificationsRepository,
} from '../repositories/email-verifications.repository';
import { SessionStoreService } from '../application/session-store.service';

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
    @Inject(IdentityService)
    private readonly identities: Pick<
      IdentityService,
      'createPasswordIdentity'
    >,
    @Inject(UsersService)
    private readonly users: Pick<UsersService, 'create'>,
    private readonly organizations: OrganizationsService,
    @Inject(WorkspacesService)
    private readonly workspaces: Pick<WorkspacesService, 'create'>,
    @Inject(MembershipsService)
    private readonly memberships: Pick<MembershipsService, 'createOwner'>,
    private readonly sessions: SessionStoreService,
    private readonly auditLog: AuditService,
    @Inject(EMAIL_VERIFICATIONS_REPOSITORY)
    private readonly emailVerifications: EmailVerificationsRepository,
    private readonly passwordPolicy: PasswordPolicy,
    private readonly sessionTokens: SessionTokenService,
    private readonly verificationTokens: EmailVerificationTokenService,
    private readonly verificationDelivery: EmailVerificationDelivery,
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

    const session = this.sessionTokens.create();
    const sessionExpiresAt = new Date(
      this.clock.now().getTime() + this.config.sessionTtlSeconds * 1000,
    );
    const verification = this.verificationTokens.create();
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
