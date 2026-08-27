import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config';
import { Clock } from '../../../common/clock';
import { IdentifierFactory } from '../../../common/identifier-factory';
import { OpaqueTokenService } from '../../../common/security/opaque-token.service';
import { TRANSACTION_MANAGER } from '../../../common/transaction-manager';
import type { TransactionManager } from '../../../common/transaction-manager';
import { AuditService } from '../../audit/audit.service';
import { MembershipsService } from '../../memberships/memberships.service';
import { SessionsService } from '../../sessions/sessions.service';
import {
  normalizeUserEmail,
  UserAlreadyExistsError,
  UsersService,
} from '../../users/users.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import {
  EmailAlreadyRegisteredError,
  RegistrationUnavailableError,
} from '../errors/authentication.errors';
import { EmailVerificationDeliveryService } from '../mail/email-verification-delivery.service';
import { EmailVerificationsRepository } from '../repositories/email-verifications.repository';
import { PasswordPolicy } from '../security/password-policy';

/** Validated values required to register one account and owner workspace. */
export type RegisterAccountCommand = {
  email: string;
  password: string;
  displayName: string;
  workspaceName: string;
};

/** Internal registration result mapped to HTTP and the opaque cookie. */
export type RegisteredAccount = {
  userId: string;
  workspaceId: string;
  displayName: string;
  workspaceName: string;
  sessionToken: string;
  sessionExpiresAt: Date;
  status: 'PENDING_VERIFICATION';
  verificationEmailQueued: true;
};

/** Atomically creates the lean account, owner workspace, session, and outbox mail. */
@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
    private readonly users: UsersService,
    private readonly workspaces: WorkspacesService,
    private readonly memberships: MembershipsService,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
    private readonly verifications: EmailVerificationsRepository,
    private readonly passwordPolicy: PasswordPolicy,
    private readonly tokens: OpaqueTokenService,
    private readonly delivery: EmailVerificationDeliveryService,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
    private readonly config: AppConfig,
  ) {}

  async register(command: RegisterAccountCommand): Promise<RegisteredAccount> {
    const normalizedEmail = normalizeUserEmail(command.email);
    const password = this.passwordPolicy.validateAndNormalize(command.password);
    let passwordHash: string;
    try {
      passwordHash = await this.users.hashPassword(password);
    } catch {
      throw new RegistrationUnavailableError();
    }

    const userId = this.identifiers.create();
    const workspaceId = this.identifiers.create();
    const session = this.tokens.create();
    const verification = this.tokens.create();
    const verificationId = this.identifiers.create();
    const now = this.clock.now();
    const sessionExpiresAt = new Date(
      now.getTime() + this.config.sessionTtlSeconds * 1000,
    );
    const verificationExpiresAt = new Date(
      now.getTime() + this.config.emailVerificationTtlSeconds * 1000,
    );
    try {
      await this.transactions.execute(async () => {
        await this.users.create({
          id: userId,
          normalizedEmail,
          passwordHash,
          displayName: command.displayName,
          status: 'PENDING_VERIFICATION',
        });
        await this.workspaces.create({
          id: workspaceId,
          ownerUserId: userId,
          name: command.workspaceName,
        });
        await this.memberships.createOwner({
          id: this.identifiers.create(),
          workspaceId,
          userId,
        });
        await this.verifications.create({
          id: verificationId,
          userId,
          workspaceId,
          tokenHash: verification.hash,
          expiresAt: verificationExpiresAt,
        });
        await this.delivery.enqueue({
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
          workspaceId,
          expiresAt: sessionExpiresAt,
        });
        await this.audit.append({
          id: this.identifiers.create(),
          workspaceId,
          actorUserId: userId,
          action: 'account.registered',
          resourceId: userId,
        });
        await this.audit.append({
          id: this.identifiers.create(),
          workspaceId,
          actorUserId: userId,
          action: 'email.verification.requested',
          resourceId: verificationId,
        });
      });
    } catch (error) {
      if (error instanceof UserAlreadyExistsError) {
        throw new EmailAlreadyRegisteredError();
      }
      this.logger.error(
        JSON.stringify({
          event: 'registration.transaction_failed',
          errorType: error instanceof Error ? error.name : 'UnknownError',
          errorCode: readSafeErrorCode(error),
        }),
      );
      throw new RegistrationUnavailableError();
    }
    return {
      userId,
      workspaceId,
      displayName: command.displayName,
      workspaceName: command.workspaceName,
      sessionToken: session.raw,
      sessionExpiresAt,
      status: 'PENDING_VERIFICATION',
      verificationEmailQueued: true,
    };
  }
}

function readSafeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  return typeof error.code === 'string' ? error.code : undefined;
}
