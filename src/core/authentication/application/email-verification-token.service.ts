import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

/** Raw email-verification secret and the hash persisted by the server. */
export type EmailVerificationToken = { raw: string; hash: string };

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Creates and validates single-use email-verification secrets. */
@Injectable()
export class EmailVerificationTokenService {
  /** Generates a URL-safe 256-bit secret and its storage hash. */
  create(): EmailVerificationToken {
    const raw = randomBytes(32).toString('base64url');
    return { raw, hash: this.hash(raw) };
  }

  /** Returns a hash only when untrusted input has the expected token shape. */
  hashIfValid(raw: string): string | undefined {
    return TOKEN_PATTERN.test(raw) ? this.hash(raw) : undefined;
  }

  /** Keeps the one-way hashing rule in one place for creation and lookup. */
  private hash(raw: string): string {
    return createHash('sha256').update(raw, 'utf8').digest('hex');
  }
}
