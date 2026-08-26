import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { SessionStateService } from '../authentication/session-state/session-state.service';
import { Clock } from '../../common/clock';
import { IdentifierFactory } from '../../common/identifier-factory';
import { TRANSACTION_MANAGER } from '../../common/transaction-manager';
import type { TransactionManager } from '../../common/transaction-manager';
import { isTransactionWriteConflict } from '../../common/transaction-write-conflict';
import {
  UserLifecycleInvalidError,
  UserLifecycleUnavailableError,
} from './users.errors';
import { UsersRepository } from './users.repository';
import type {
  UserAuthenticationReference,
  UserStatus,
  UserSummary,
} from './users.types';

export type {
  UserAuthenticationReference,
  UserStatus,
  UserSummary,
} from './users.types';

/** Public service for user-owned profile and lifecycle behavior. */
@Injectable()
export class UsersService {
  private readonly logger = new Logger('UpdateOwnProfile');

  constructor(
    private readonly repository: UsersRepository,
    private readonly sessionAuthority: SessionStateService,
    private readonly audit: AuditService,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
  ) {}

  /** Creates a user as part of a caller-owned onboarding transaction. */
  create(input: {
    id: string;
    identityId: string;
    displayName: string;
    status: UserStatus;
  }): Promise<void> {
    return this.repository.create(input);
  }

  /** Finds a public user summary by stable identifier. */
  findById(id: string): Promise<UserSummary | null> {
    return this.repository.findById(id);
  }

  /** Finds the identity link required by credential workflows. */
  findAuthenticationReferenceById(
    id: string,
  ): Promise<UserAuthenticationReference | null> {
    return this.repository.findAuthenticationReferenceById(id);
  }

  /** Finds a user summary by its owning identity. */
  findByIdentityId(identityId: string): Promise<UserSummary | null> {
    return this.repository.findByIdentityId(identityId);
  }

  /** Finds an active user by identity for sign-in. */
  findActiveByIdentityId(identityId: string): Promise<UserSummary | null> {
    return this.repository.findActiveByIdentityId(identityId);
  }

  /** Activates a pending user exactly once. */
  activate(id: string): Promise<boolean> {
    return this.repository.activate(id);
  }

  /** Revalidates and atomically updates the trusted actor's own profile. */
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
            this.sessionAuthority.hasActiveContext({
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

          const updated = await this.repository.updateDisplayName({
            id: user.id,
            expectedDisplayName: user.displayName,
            displayName,
          });
          if (!updated) throw new UserWriteConflictError();

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

/** Internal signal used to retry one compare-and-set race. */
class UserWriteConflictError extends Error {}

/** Recognizes local and transaction-manager write conflicts. */
function isWriteConflict(error: unknown): boolean {
  return (
    error instanceof UserWriteConflictError || isTransactionWriteConflict(error)
  );
}

/** Extracts only a non-sensitive string code for structured logs. */
function readSafeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  return typeof error.code === 'string' ? error.code : undefined;
}
