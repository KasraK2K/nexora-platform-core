import { Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AppConfig } from '../../configuration/app-config';
import { PwnedPasswordsCompromiseChecker } from './pwned-passwords-compromise-checker';

describe('PwnedPasswordsCompromiseChecker', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.APP_ORIGINS = 'http://localhost:3000';
    process.env.TRUST_PROXY = '';
    process.env.RATE_LIMIT_KEY_SECRET = 'unit-test-rate-limit-secret-value';
    process.env.COOKIE_SECURE = 'true';
    process.env.SESSION_TTL_SECONDS = '3600';
    process.env.PWNED_PASSWORDS_TIMEOUT_MS = '1000';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects a local blocklist match without making a remote request', async () => {
    process.env.PWNED_PASSWORDS_ENABLED = 'true';
    const fetch = jest.spyOn(globalThis, 'fetch');
    const checker = new PwnedPasswordsCompromiseChecker(new AppConfig());

    await expect(checker.isCompromised('123456789012345')).resolves.toBe(true);
    await expect(
      checker.isCompromised('nexora-platform-core-password'),
    ).resolves.toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects an exact remote range match using only a five-character prefix', async () => {
    process.env.PWNED_PASSWORDS_ENABLED = 'true';
    const password = 'A unique remote lookup passphrase 2026';
    const hash = createHash('sha1')
      .update(password, 'utf8')
      .digest('hex')
      .toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(`${'0'.repeat(35)}:0\r\n${suffix}:42\r\n`, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );
    const checker = new PwnedPasswordsCompromiseChecker(new AppConfig());

    await expect(checker.isCompromised(password)).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = fetch.mock.calls[0];
    expect(requestUrl).toBe(`https://api.pwnedpasswords.com/range/${prefix}`);
    expect(requestInit?.redirect).toBe('error');
    expect(new Headers(requestInit?.headers).get('Add-Padding')).toBe('true');
    expect(new Headers(requestInit?.headers).get('User-Agent')).toBe(
      'NexoraPlatformCore-password-screening/1.0',
    );
    expect(JSON.stringify(fetch.mock.calls)).not.toContain(password);
    expect(JSON.stringify(fetch.mock.calls)).not.toContain(hash);
  });

  it('uses only the local fallback when remote lookup is disabled', async () => {
    process.env.PWNED_PASSWORDS_ENABLED = 'false';
    const fetch = jest.spyOn(globalThis, 'fetch');
    const checker = new PwnedPasswordsCompromiseChecker(new AppConfig());

    await expect(
      checker.isCompromised('A unique local-only passphrase 2026'),
    ).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('falls back safely when the remote request fails', async () => {
    process.env.PWNED_PASSWORDS_ENABLED = 'true';
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new TypeError('network unavailable'));
    const checker = new PwnedPasswordsCompromiseChecker(new AppConfig());

    await expect(
      checker.isCompromised('A unique unavailable passphrase 2026'),
    ).resolves.toBe(false);
  });

  it('rejects malformed or oversized provider responses', async () => {
    process.env.PWNED_PASSWORDS_ENABLED = 'true';
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('not-a-range-response'))
      .mockResolvedValueOnce(new Response('x'.repeat(128 * 1024 + 1)));
    const checker = new PwnedPasswordsCompromiseChecker(new AppConfig());

    await expect(
      checker.isCompromised('A unique malformed passphrase 2026'),
    ).resolves.toBe(false);
    await expect(
      checker.isCompromised('A unique oversized passphrase 2026'),
    ).resolves.toBe(false);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
