import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { PasswordCompromiseChecker } from '../application/password-compromise-checker.port';
import { AppConfig } from '../../configuration/app-config';
import { COMMON_PASSWORD_SHA256_HASHES } from './common-password-hashes.generated';

const PWNED_PASSWORDS_RANGE_URL = 'https://api.pwnedpasswords.com/range/';
const MAX_RESPONSE_BYTES = 128 * 1024;
const RANGE_ENTRY_PATTERN = /^([A-F0-9]{35}):([0-9]{1,10})$/;
const CONTEXT_SPECIFIC_PASSWORDS = [
  'nexorapassword1',
  'nexora-ai-password',
  'nexora-platform-core-password',
  'nexora123456789',
  'password-for-nexora',
  'nexoraai20262026',
] as const;

/** Screens passwords against local hashes and the Pwned Passwords range API. */
@Injectable()
export class PwnedPasswordsCompromiseChecker implements PasswordCompromiseChecker {
  private readonly logger = new Logger(PwnedPasswordsCompromiseChecker.name);
  private readonly localHashes = new Set([
    ...COMMON_PASSWORD_SHA256_HASHES,
    ...CONTEXT_SPECIFIC_PASSWORDS.map((password) => localHash(password)),
  ]);

  constructor(private readonly config: AppConfig) {}

  /**
   * Checks local deny-list hashes first, then optionally uses k-anonymity remote
   * lookup. Remote unavailability fails open and emits a content-free warning.
   */
  async isCompromised(password: string): Promise<boolean> {
    const normalized = password.normalize('NFC');
    if (this.localHashes.has(localHash(normalized))) {
      return true;
    }

    if (!this.config.pwnedPasswordsEnabled) {
      return false;
    }

    return this.lookupPwnedPasswords(normalized);
  }

  /** Sends only the first five SHA-1 hex characters and validates a bounded response. */
  private async lookupPwnedPasswords(password: string): Promise<boolean> {
    const hash = createHash('sha1')
      .update(password, 'utf8')
      .digest('hex')
      .toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    try {
      const response = await fetch(`${PWNED_PASSWORDS_RANGE_URL}${prefix}`, {
        cache: 'no-store',
        headers: {
          Accept: 'text/plain',
          'Add-Padding': 'true',
          'User-Agent': 'NexoraPlatformCore-password-screening/1.0',
        },
        redirect: 'error',
        signal: AbortSignal.timeout(this.config.pwnedPasswordsTimeoutMs),
      });

      if (!response.ok) {
        this.warnFallback('http_error');
        return false;
      }

      const body = await readBoundedText(response);
      if (body === undefined) {
        this.warnFallback('invalid_response');
        return false;
      }

      const result = findSuffix(body, suffix);
      if (result === undefined) {
        this.warnFallback('invalid_response');
        return false;
      }
      return result;
    } catch {
      this.warnFallback('request_failed');
      return false;
    }
  }

  /** Records why remote screening was skipped without logging password material. */
  private warnFallback(reason: string): void {
    this.logger.warn(
      JSON.stringify({ event: 'pwned_passwords.fallback_used', reason }),
    );
  }
}

/** Produces a normalized local deny-list hash without retaining plaintext. */
function localHash(password: string): string {
  return createHash('sha256')
    .update(password.normalize('NFC').toLocaleLowerCase('en-US'), 'utf8')
    .digest('hex');
}

/** Reads a strictly bounded UTF-8 response to prevent oversized range data. */
async function readBoundedText(
  response: Response,
): Promise<string | undefined> {
  const contentLength = response.headers.get('content-length');
  if (
    contentLength !== null &&
    (!/^[0-9]+$/.test(contentLength) ||
      Number(contentLength) > MAX_RESPONSE_BYTES)
  ) {
    return undefined;
  }

  if (!response.body) {
    return undefined;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    totalBytes += value.byteLength;
    if (totalBytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

/** Validates every range entry before matching the expected SHA-1 suffix. */
function findSuffix(body: string, expectedSuffix: string): boolean | undefined {
  const lines = body.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) {
    return undefined;
  }

  let found = false;
  for (const line of lines) {
    const match = RANGE_ENTRY_PATTERN.exec(line);
    if (!match) {
      return undefined;
    }
    if (match[1] === expectedSuffix && Number(match[2]) > 0) {
      found = true;
    }
  }
  return found;
}
