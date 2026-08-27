import { Inject, Injectable, Logger } from '@nestjs/common';
import { argon2id, hash, verify } from 'argon2';
import { Clock } from '../../common/clock';
import { IdentifierFactory } from '../../common/identifier-factory';
import { TRANSACTION_MANAGER } from '../../common/transaction-manager';
import type { TransactionManager } from '../../common/transaction-manager';
import { isTransactionWriteConflict } from '../../common/transaction-write-conflict';
import { AuditService } from '../audit/audit.service';
import { SessionsService } from '../sessions/sessions.service';
import {
  UserLifecycleInvalidError,
  UserLifecycleUnavailableError,
} from './users.errors';
import { UsersRepository } from './users.repository';
import type { UserAccount, UserStatus, UserSummary } from './users.types';

export type { UserAccount, UserStatus, UserSummary } from './users.types';
export { UserAlreadyExistsError } from './users.errors';

const VERIFIED_PASSWORD_HASH = Symbol('VERIFIED_PASSWORD_HASH');
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,p=1,t=2$m6TgZh+TYlE0sbmXNwsuIw$01f3hHVKm4WKs5fNxApXV9euvbv1DcLnMNRCVNrwy1Y';

/** Proof that the caller verified the current stored password hash. */
export type VerifiedUserPassword = Readonly<{
  userId: string;
  [VERIFIED_PASSWORD_HASH]: string;
}>;

/** Produces the one canonical email form used by account lookups. */
export function normalizeUserEmail(email: string): string {
  return email.trim().toLocaleLowerCase('en-US');
}

/** Public service for account, profile, and credential behavior. */
@Injectable()
export class UsersService {
  private readonly logger = new Logger('UpdateOwnProfile');

  constructor(
    private readonly repository: UsersRepository,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
  ) {}

  create(input: {
    id: string;
    normalizedEmail: string;
    passwordHash: string;
    displayName: string;
    status: UserStatus;
  }): Promise<void> {
    return this.repository.create(input);
  }

  findById(id: string): Promise<UserSummary | null> {
    return this.repository.findById(id);
  }

  findAccountById(id: string): Promise<UserAccount | null> {
    return this.repository.findAccountById(id);
  }

  findByEmail(email: string): Promise<UserAccount | null> {
    return this.repository.findByNormalizedEmail(normalizeUserEmail(email));
  }

  async authenticate(input: {
    email: string;
    password: string;
  }): Promise<UserSummary | null> {
    const credential = await this.repository.findCredentialByNormalizedEmail(
      normalizeUserEmail(input.email),
    );
    const matches = await verify(
      credential?.passwordHash ?? DUMMY_PASSWORD_HASH,
      input.password.normalize('NFC'),
    );
    if (!matches || !credential) return null;
    const user = await this.repository.findById(credential.id);
    return user?.status === 'ACTIVE' ? user : null;
  }

  hashPassword(password: string): Promise<string> {
    return hash(password.normalize('NFC'), {
      type: argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  async verifyPassword(input: {
    userId: string;
    password: string;
  }): Promise<VerifiedUserPassword | null> {
    const credential = await this.repository.findCredentialById(input.userId);
    const matches = await verify(
      credential?.passwordHash ?? DUMMY_PASSWORD_HASH,
      input.password.normalize('NFC'),
    );
    return matches && credential
      ? {
          userId: credential.id,
          [VERIFIED_PASSWORD_HASH]: credential.passwordHash,
        }
      : null;
  }

  replacePasswordHash(userId: string, passwordHash: string): Promise<boolean> {
    return this.repository.replacePasswordHash(userId, passwordHash);
  }

  replacePasswordHashIfVerified(
    verified: VerifiedUserPassword,
    passwordHash: string,
  ): Promise<boolean> {
    return this.repository.replacePasswordHashIfCurrent({
      id: verified.userId,
      expectedPasswordHash: verified[VERIFIED_PASSWORD_HASH],
      passwordHash,
    });
  }

  activate(id: string): Promise<boolean> {
    return this.repository.activate(id);
  }

  async updateOwnProfile(input: {
    sessionId: string;
    actorUserId: string;
    workspaceId: string;
    displayName: string;
  }): Promise<UserSummary> {
    const displayName = input.displayName.trim();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.transactions.execute(async () => {
          const now = this.clock.now();
          const [sessionIsActive, user] = await Promise.all([
            this.sessions.hasActiveContext({
              sessionId: input.sessionId,
              userId: input.actorUserId,
              workspaceId: input.workspaceId,
              now,
            }),
            this.repository.findById(input.actorUserId),
          ]);
          if (!sessionIsActive || !user || user.status !== 'ACTIVE') {
            throw new UserLifecycleInvalidError();
          }
          if (user.displayName === displayName) return user;
          if (
            !(await this.repository.updateDisplayName({
              id: user.id,
              expectedDisplayName: user.displayName,
              displayName,
            }))
          ) {
            throw new UserWriteConflictError();
          }
          await this.audit.append({
            id: this.identifiers.create(),
            workspaceId: input.workspaceId,
            actorUserId: input.actorUserId,
            action: 'user.profile.updated',
            resourceId: input.actorUserId,
          });
          return Object.freeze({ ...user, displayName });
        });
      } catch (error) {
        if (attempt === 0 && isWriteConflict(error)) continue;
        if (error instanceof UserLifecycleInvalidError) throw error;
        this.logger.error(
          JSON.stringify({
            event: 'user.profile_update_failed',
            errorType: error instanceof Error ? error.name : 'UnknownError',
            errorCode: readSafeErrorCode(error),
          }),
        );
        throw new UserLifecycleUnavailableError();
      }
    }
    throw new UserLifecycleUnavailableError();
  }
}

class UserWriteConflictError extends Error {}

function isWriteConflict(error: unknown): boolean {
  return (
    error instanceof UserWriteConflictError || isTransactionWriteConflict(error)
  );
}

function readSafeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  return typeof error.code === 'string' ? error.code : undefined;
}
