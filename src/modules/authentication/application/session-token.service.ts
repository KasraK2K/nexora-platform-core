import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

/** Raw opaque session secret and the one-way hash stored by the server. */
export type SessionToken = {
  raw: string;
  hash: string;
};

const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Creates and validates fixed-shape opaque session secrets. */
@Injectable()
export class SessionTokenService {
  /** Generates a new 256-bit secret and its SHA-256 storage hash. */
  create(): SessionToken {
    const raw = randomBytes(32).toString('base64url');
    return { raw, hash: this.hash(raw) };
  }

  /** Hashes a trusted, already validated raw token. */
  hash(raw: string): string {
    return createHash('sha256').update(raw, 'utf8').digest('hex');
  }

  /** Rejects malformed input before hashing untrusted cookie data. */
  hashIfValid(raw: string | undefined): string | undefined {
    return raw && SESSION_TOKEN_PATTERN.test(raw) ? this.hash(raw) : undefined;
  }
}
