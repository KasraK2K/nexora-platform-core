import type { Clock } from '../../common/clock';
import type { IdentifierFactory } from '../../common/identifier-factory';
import type { TransactionManager } from '../../common/transaction-manager';
import type { AuditService } from '../audit/audit.service';
import type { SessionsService } from '../sessions/sessions.service';
import type { UsersRepository } from './users.repository';
import { normalizeUserEmail, UsersService } from './users.service';

describe('UsersService credentials', () => {
  it('normalizes email in one obvious User-owned function', () => {
    expect(normalizeUserEmail('  Owner@Example.COM ')).toBe(
      'owner@example.com',
    );
  });

  it('hashes with Argon2id and performs active-user authentication', async () => {
    const records = new Map<string, { id: string; passwordHash: string }>();
    const repository = {
      findCredentialByNormalizedEmail(email: string) {
        return Promise.resolve(records.get(email) ?? null);
      },
      findById(id: string) {
        return Promise.resolve({
          id,
          displayName: 'Owner',
          status: 'ACTIVE' as const,
        });
      },
    } as unknown as UsersRepository;
    const users = new UsersService(
      repository,
      {} as SessionsService,
      {} as AuditService,
      {} as IdentifierFactory,
      {} as Clock,
      {} as TransactionManager,
    );
    const passwordHash = await users.hashPassword('A secure passphrase 123');
    expect(passwordHash.startsWith('$argon2id$')).toBe(true);
    records.set('owner@example.test', { id: 'user-id', passwordHash });
    await expect(
      users.authenticate({
        email: ' OWNER@example.test ',
        password: 'A secure passphrase 123',
      }),
    ).resolves.toMatchObject({ id: 'user-id', status: 'ACTIVE' });
    await expect(
      users.authenticate({
        email: 'owner@example.test',
        password: 'wrong password',
      }),
    ).resolves.toBeNull();
  });
});
