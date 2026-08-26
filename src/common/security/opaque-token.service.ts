import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

const OPAQUE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Raw 256-bit secret and the one-way hash stored by the server. */
export type OpaqueToken = Readonly<{ raw: string; hash: string }>;

/** Creates, validates, and hashes the application's fixed-shape opaque tokens. */
@Injectable()
export class OpaqueTokenService {
  /** Generates a URL-safe 256-bit token and its SHA-256 storage hash. */
  create(): OpaqueToken {
    const raw = randomBytes(32).toString('base64url');
    return { raw, hash: this.hash(raw) };
  }

  /** Hashes trusted token or deterministic uniqueness material. */
  hash(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }

  /** Rejects malformed untrusted token input before hashing it. */
  hashIfValid(raw: string | undefined): string | undefined {
    return raw && OPAQUE_TOKEN_PATTERN.test(raw) ? this.hash(raw) : undefined;
  }
}
