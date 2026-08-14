import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditLog } from '../../audit/application/audit-log';
import { MembershipSessionRevocations } from '../../authentication/application/membership-session-revocations';
import { AuthorizationPolicy } from '../../authorization/application/authorization-policy';
import { AuthorizationDeniedError } from '../../authorization/application/authorization-denied.error';
import { PasswordCredentialVerification } from '../../identity/application/password-credential-verification';
import { Users } from '../../users/application/users';
import { Clock } from '../../../shared/application/clock';
import { IdentifierFactory } from '../../../shared/application/identifier-factory';
import { TRANSACTION_MANAGER } from '../../../shared/application/transaction-manager.port';
import type { TransactionManager } from '../../../shared/application/transaction-manager.port';
import { isTransactionWriteConflict } from '../../../shared/application/transaction-write-conflict';
import {
  MembershipAdministrationUnavailableError,
  MembershipOwnershipTransferInvalidError,
} from '../domain/membership-administration.errors';
import { MembershipAdministration } from './membership-administration';

/** Narrow current-password verifier used for ownership-transfer step-up. */
type CurrentPasswordProof = {
  verify(input: {
    identityId: string;
    password: string;
  }): Promise<object | null>;
};

/**
 * Transfers operational workspace ownership after current-session and password
 * proof. Actor and target memberships, sole-owner state, compound role writes,
 * and audit are rechecked and committed in one transaction; commercial
 * organization ownership is intentionally unchanged.
 */
@Injectable()
export class TransferWorkspaceOwnership {
  private readonly logger = new Logger(TransferWorkspaceOwnership.name);

  constructor(
    private readonly memberships: MembershipAdministration,
    @Inject(MembershipSessionRevocations)
    private readonly sessionAuthority: Pick<
      MembershipSessionRevocations,
      'hasActiveContext'
    >,
    @Inject(Users)
    private readonly users: Pick<Users, 'findAuthenticationReferenceById'>,
    @Inject(PasswordCredentialVerification)
    private readonly passwordCredentials: CurrentPasswordProof,
    private readonly authorization: AuthorizationPolicy,
    private readonly auditLog: AuditLog,
    private readonly identifiers: IdentifierFactory,
    private readonly clock: Clock,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
  ) {}

  /**
   * Promotes one active non-owner and demotes the sole current owner atomically.
   * Invalid session, password, target, or owner count share one safe confirmation
   * error; unexpected failures become retryable administration unavailability.
   */
  async execute(input: {
    sessionId: string;
    actorUserId: string;
    workspaceId: string;
    membershipId: string;
    currentPassword: string;
  }): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await this.transactions.execute(async () => {
          const now = this.clock.now();
          const [sessionIsActive, actor, actorUser] = await Promise.all([
            this.sessionAuthority.hasActiveContext({
              sessionId: input.sessionId,
              userId: input.actorUserId,
              workspaceId: input.workspaceId,
              now,
            }),
            this.memberships.findActiveForUser(
              input.workspaceId,
              input.actorUserId,
            ),
            this.users.findAuthenticationReferenceById(input.actorUserId),
          ]);
          if (
            !actor ||
            !this.authorization.permits(
              actor.role,
              'membership:ownership:transfer',
            )
          ) {
            throw new AuthorizationDeniedError();
          }
          if (!sessionIsActive || !actorUser || actorUser.status !== 'ACTIVE') {
            throw new MembershipOwnershipTransferInvalidError();
          }
          if (
            !(await this.passwordCredentials.verify({
              identityId: actorUser.identityId,
              password: input.currentPassword,
            }))
          ) {
            throw new MembershipOwnershipTransferInvalidError();
          }

          const [target, ownerCount] = await Promise.all([
            this.memberships.findActiveById(
              input.workspaceId,
              input.membershipId,
            ),
            this.memberships.countActiveOwners(input.workspaceId),
          ]);
          if (
            !target ||
            target.role === 'OWNER' ||
            ownerCount !== 1 ||
            !this.authorization.mayTransferWorkspaceOwnership(actor, target)
          ) {
            throw new MembershipOwnershipTransferInvalidError();
          }

          if (
            !(await this.memberships.transferOwnership({
              workspaceId: input.workspaceId,
              currentOwnerMembershipId: actor.id,
              targetMembershipId: target.id,
              expectedTargetRole: target.role,
            }))
          ) {
            throw new MembershipWriteConflictError();
          }
          await this.auditLog.append({
            id: this.identifiers.create(),
            workspaceId: input.workspaceId,
            actorUserId: input.actorUserId,
            action: 'membership.ownership.transferred',
            resourceId: target.id,
          });
        });
        return;
      } catch (error) {
        if (attempt === 0 && isWriteConflict(error)) continue;
        if (
          error instanceof AuthorizationDeniedError ||
          error instanceof MembershipOwnershipTransferInvalidError
        ) {
          throw error;
        }
        this.logFailure(error);
        throw new MembershipAdministrationUnavailableError();
      }
    }
  }

  /** Logs safe failure metadata without password, session, or membership data. */
  private logFailure(error: unknown): void {
    this.logger.error(
      JSON.stringify({
        event: 'membership.ownership_transfer_failed',
        errorType: error instanceof Error ? error.name : 'UnknownError',
        errorCode: readSafeErrorCode(error),
      }),
    );
  }
}

/** Signals a compound compare-and-set miss for whole-transaction retry. */
class MembershipWriteConflictError extends Error {}

/** Recognizes local compare-and-set misses and adapter transaction conflicts. */
function isWriteConflict(error: unknown): boolean {
  return (
    error instanceof MembershipWriteConflictError ||
    isTransactionWriteConflict(error)
  );
}

/** Extracts only a safe database-style code for redacted logging. */
function readSafeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  return typeof error.code === 'string' ? error.code : undefined;
}
