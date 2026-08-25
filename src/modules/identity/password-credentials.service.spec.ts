import { PasswordCredentialsService } from './password-credentials.service';
import type { PasswordVerifier } from './ports/password-verifier.port';
import type {
  PasswordCredentialManagementRepository,
  PasswordCredentialVerificationRepository,
  PasswordIdentityRepository,
} from './repositories/password-credentials.repository';

class RecordingVerifier implements PasswordVerifier {
  calls: Array<{ password: string; passwordHash: string | null }> = [];
  result = false;

  matches(password: string, passwordHash: string | null): Promise<boolean> {
    this.calls.push({ password, passwordHash });
    return Promise.resolve(this.result);
  }
}

describe('PasswordCredentialsService', () => {
  it('performs dummy verification and returns the same null result for an unknown email', async () => {
    const verifier = new RecordingVerifier();
    const authentication = new PasswordCredentialsService(
      repositoryReturning(null),
      passwordManagement(),
      passwordVerification(),
      verifier,
    );

    await expect(
      authentication.authenticate({
        email: ' Missing@Example.com ',
        password: 'A wrong passphrase',
      }),
    ).resolves.toBeNull();
    expect(verifier.calls).toEqual([
      { password: 'A wrong passphrase', passwordHash: null },
    ]);
  });

  it('returns only the identity id after a matching credential', async () => {
    const verifier = new RecordingVerifier();
    verifier.result = true;
    const authentication = new PasswordCredentialsService(
      repositoryReturning({
        identityId: 'identity-id',
        passwordHash: 'stored-hash',
      }),
      passwordManagement(),
      passwordVerification(),
      verifier,
    );

    await expect(
      authentication.authenticate({
        email: ' PERSON@Example.com ',
        password: 'A secure passphrase 123',
      }),
    ).resolves.toEqual({ identityId: 'identity-id' });
    expect(verifier.calls).toEqual([
      {
        password: 'A secure passphrase 123',
        passwordHash: 'stored-hash',
      },
    ]);
  });
});

function repositoryReturning(
  result: Awaited<
    ReturnType<PasswordIdentityRepository['findByNormalizedEmail']>
  >,
): PasswordIdentityRepository {
  return {
    findByNormalizedEmail(normalizedEmail) {
      expect(normalizedEmail).toMatch(/^[a-z]+@example\.com$/);
      return Promise.resolve(result);
    },
  };
}

function passwordManagement(): PasswordCredentialManagementRepository {
  return { replacePasswordHash: () => Promise.resolve(false) };
}

function passwordVerification(): PasswordCredentialVerificationRepository {
  return {
    findByIdentityId: () => Promise.resolve(null),
    replacePasswordHashIfCurrent: () => Promise.resolve(false),
  };
}
