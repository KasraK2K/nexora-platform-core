import {
  AuditLog,
  type AppendAuditLog,
} from '../../audit/application/audit-log';
import { Users } from '../../users/application/users';
import { Clock } from '../../../shared/application/clock';
import { IdentifierFactory } from '../../../shared/application/identifier-factory';
import type { TransactionManager } from '../../../shared/application/transaction-manager.port';
import { EmailVerificationInvalidError } from '../domain/registration.errors';
import { EmailVerificationTokenService } from './email-verification-token.service';
import {
  EmailVerifications,
  type EmailVerificationsRepository,
} from './email-verifications';
import { VerifyEmail } from './verify-email.use-case';

class InlineTransactionManager implements TransactionManager {
  execute<T>(operation: () => Promise<T>): Promise<T> {
    return operation();
  }
}

describe('VerifyEmail', () => {
  it('consumes one token, activates the user, and rejects replay', async () => {
    const fixture = createFixture();

    await fixture.useCase.execute(fixture.rawToken);

    expect(fixture.userStatus()).toBe('ACTIVE');
    expect(fixture.audits).toEqual([
      expect.objectContaining({
        action: 'email.verified',
        actorUserId: 'user-id',
        workspaceId: 'workspace-id',
      }),
    ]);
    await expect(
      fixture.useCase.execute(fixture.rawToken),
    ).rejects.toBeInstanceOf(EmailVerificationInvalidError);
  });

  it('uses the same safe error for an expired token', async () => {
    const fixture = createFixture({ expired: true });

    await expect(
      fixture.useCase.execute(fixture.rawToken),
    ).rejects.toBeInstanceOf(EmailVerificationInvalidError);
    expect(fixture.userStatus()).toBe('PENDING_VERIFICATION');
    expect(fixture.audits).toHaveLength(0);
  });
});

function createFixture(options?: { expired?: boolean }) {
  const tokens = new EmailVerificationTokenService();
  const token = tokens.create();
  const clock = new Clock();
  const now = new Date('2026-08-08T00:00:00.000Z');
  jest.spyOn(clock, 'now').mockReturnValue(now);
  let consumed = false;
  let status: 'PENDING_VERIFICATION' | 'ACTIVE' = 'PENDING_VERIFICATION';
  const repository: EmailVerificationsRepository = {
    create: () => Promise.resolve(),
    invalidateOpenForUser: () => Promise.resolve(),
    findUsableByTokenHash: (tokenHash, at) =>
      Promise.resolve(
        !consumed &&
          tokenHash === token.hash &&
          (!options?.expired || at.getTime() < now.getTime() - 1)
          ? {
              id: 'verification-id',
              userId: 'user-id',
              workspaceId: 'workspace-id',
            }
          : null,
      ),
    findLatestForUser: () => Promise.resolve(null),
    consume: () => {
      if (consumed) return Promise.resolve(false);
      consumed = true;
      return Promise.resolve(true);
    },
    markDelivery: () => Promise.resolve(),
  };
  const users = new Users({
    create: () => Promise.resolve(),
    findById: () =>
      Promise.resolve({ id: 'user-id', displayName: 'Person', status }),
    findAuthenticationReferenceById: () => Promise.resolve(null),
    findByIdentityId: () => Promise.resolve(null),
    findActiveByIdentityId: () => Promise.resolve(null),
    activate: () => {
      if (status !== 'PENDING_VERIFICATION') return Promise.resolve(false);
      status = 'ACTIVE';
      return Promise.resolve(true);
    },
  });
  const audits: AppendAuditLog[] = [];
  const auditLog = new AuditLog({
    append: (input) => {
      audits.push(input);
      return Promise.resolve();
    },
  });

  return {
    rawToken: token.raw,
    audits,
    userStatus: () => status,
    useCase: new VerifyEmail(
      new EmailVerifications(repository),
      users,
      auditLog,
      tokens,
      new IdentifierFactory(),
      clock,
      new InlineTransactionManager(),
    ),
  };
}
