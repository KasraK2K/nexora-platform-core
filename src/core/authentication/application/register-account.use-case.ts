import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditLog } from '../../audit/application/audit-log';
import { AppConfig } from '../../configuration/app-config';
import { IdentityRegistration } from '../../identity/application/identity-registration';
import { IdentityAlreadyExistsError } from '../../identity/domain/identity-already-exists.error';
import { Memberships } from '../../memberships/application/memberships';
import { Organizations } from '../../organizations/application/organizations';
import { Users } from '../../users/application/users';
import { Workspaces } from '../../workspaces/application/workspaces';
import { Clock } from '../../../shared/application/clock';
import { IdentifierFactory } from '../../../shared/application/identifier-factory';
import { TRANSACTION_MANAGER } from '../../../shared/application/transaction-manager.port';
import type { TransactionManager } from '../../../shared/application/transaction-manager.port';
import { PasswordPolicy } from '../domain/password-policy';
import {
  EmailAlreadyRegisteredError,
  RegistrationUnavailableError,
} from '../domain/registration.errors';
import { AuthenticationSessions } from './authentication-sessions';
import { PASSWORD_HASHER } from './password-hasher.port';
import type { PasswordHasher } from './password-hasher.port';
import { SessionTokenService } from './session-token.service';
import { SESSION_CACHE } from './session-cache.port';
import type { SessionCachePort } from './session-cache.port';

export type RegisterAccountCommand = {
  email: string;
  password: string;
  displayName: string;
  organizationName: string;
  workspaceName: string;
};

export type RegisteredAccount = {
  userId: string;
  organizationId: string;
  workspaceId: string;
  displayName: string;
  organizationName: string;
  workspaceName: string;
  sessionToken: string;
  sessionExpiresAt: Date;
};

@Injectable()
export class RegisterAccount {
  private readonly logger = new Logger(RegisterAccount.name);

  constructor(
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
    private readonly identities: IdentityRegistration,
    private readonly users: Users,
    private readonly organizations: Organizations,
    private readonly workspaces: Workspaces,
    private readonly memberships: Memberships,
    private readonly sessions: AuthenticationSessions,
    private readonly auditLog: AuditLog,
    @Inject(SESSION_CACHE) private readonly sessionCache: SessionCachePort,
    private readonly passwordPolicy: PasswordPolicy,
    private readonly sessionTokens: SessionTokenService,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
    private readonly config: AppConfig,
  ) {}

  async execute(command: RegisterAccountCommand): Promise<RegisteredAccount> {
    const normalizedEmail = command.email.trim().toLocaleLowerCase('en-US');
    const password = this.passwordPolicy.validateAndNormalize(command.password);
    const session = this.sessionTokens.create();
    const sessionExpiresAt = new Date(
      this.clock.now().getTime() + this.config.sessionTtlSeconds * 1000,
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
      });
    } catch (error) {
      if (error instanceof IdentityAlreadyExistsError) {
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

    // PostgreSQL owns the durable session. Redis is a disposable lookup cache;
    // cache loss must not turn a committed registration into an ambiguous failure.
    await this.sessionCache
      .store(session.hash, { userId, workspaceId }, sessionExpiresAt)
      .catch(() => undefined);

    return {
      userId,
      organizationId,
      workspaceId,
      displayName: command.displayName,
      organizationName: command.organizationName,
      workspaceName: command.workspaceName,
      sessionToken: session.raw,
      sessionExpiresAt,
    };
  }
}

function readSafeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  return typeof error.code === 'string' ? error.code : undefined;
}
