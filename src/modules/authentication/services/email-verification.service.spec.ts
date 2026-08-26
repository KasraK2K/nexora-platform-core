import { AuditService, type AppendAuditLog } from '../../audit/audit.service';
import { UsersService } from '../../users/users.service';
import { Clock } from '../../../common/clock';
import { IdentifierFactory } from '../../../common/identifier-factory';
import type { TransactionManager } from '../../../common/transaction-manager';
import { EmailVerificationInvalidError } from '../errors/authentication.errors';
import { OpaqueTokenService } from '../../../common/security/opaque-token.service';
import { EmailVerificationService } from './email-verification.service';

class InlineTransactionManager implements TransactionManager {
  execute<T>(operation: () => Promise<T>): Promise<T> {
    return operation();
  }
}

describe('EmailVerificationService.confirm', () => {
  it('consumes one token, activates the user, and rejects replay', async () => {
    const fixture = createFixture();

    await fixture.service.confirm(fixture.rawToken);

    expect(fixture.userStatus()).toBe('ACTIVE');
    expect(fixture.audits).toEqual([
      expect.objectContaining({
        action: 'email.verified',
        actorUserId: 'user-id',
        workspaceId: 'workspace-id',
      }),
    ]);
    await expect(
      fixture.service.confirm(fixture.rawToken),
    ).rejects.toBeInstanceOf(EmailVerificationInvalidError);
  });

  it('uses the same safe error for an expired token', async () => {
    const fixture = createFixture({ expired: true });

    await expect(
      fixture.service.confirm(fixture.rawToken),
    ).rejects.toBeInstanceOf(EmailVerificationInvalidError);
    expect(fixture.userStatus()).toBe('PENDING_VERIFICATION');
    expect(fixture.audits).toHaveLength(0);
  });
});

function createFixture(options?: { expired?: boolean }) {
  const tokens = new OpaqueTokenService();
  const token = tokens.create();
  const clock = new Clock();
  const now = new Date('2026-08-08T00:00:00.000Z');
  jest.spyOn(clock, 'now').mockReturnValue(now);
  let consumed = false;
  let status: 'PENDING_VERIFICATION' | 'ACTIVE' = 'PENDING_VERIFICATION';
  const repository = {
    create: () => Promise.resolve(),
    invalidateOpenForUser: () => Promise.resolve(),
    findUsableByTokenHash: (tokenHash: string, at: Date) =>
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
  const users: Pick<UsersService, 'activate'> = {
    activate: () => {
      if (status !== 'PENDING_VERIFICATION') return Promise.resolve(false);
      status = 'ACTIVE';
      return Promise.resolve(true);
    },
  };
  const audits: AppendAuditLog[] = [];
  const auditLog = new AuditService({
    append: (input: AppendAuditLog) => {
      audits.push(input);
      return Promise.resolve();
    },
  } as never);

  return {
    rawToken: token.raw,
    audits,
    userStatus: () => status,
    service: new EmailVerificationService(
      undefined as never,
      users as never,
      repository as never,
      undefined as never,
      tokens,
      new IdentifierFactory(),
      clock,
      auditLog,
      undefined as never,
      new InlineTransactionManager(),
    ),
  };
}
