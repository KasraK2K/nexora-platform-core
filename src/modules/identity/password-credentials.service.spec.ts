import { PasswordCredentialsService } from './password-credentials.service';
import type { PasswordVerifier } from './security/password-verifier';
import type { PasswordCredentialsRepository } from './password-credentials.repository';

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
      repositoryReturning(null) as never,
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
      }) as never,
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
    ReturnType<PasswordCredentialsRepository['findByNormalizedEmail']>
  >,
): Pick<PasswordCredentialsRepository, 'findByNormalizedEmail'> {
  return {
    findByNormalizedEmail(normalizedEmail) {
      expect(normalizedEmail).toMatch(/^[a-z]+@example\.com$/);
      return Promise.resolve(result);
    },
  };
}
