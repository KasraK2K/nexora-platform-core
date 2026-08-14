import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

/** Shape of a 32-byte base64url token accepted at the request boundary. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Creates invitation secrets while exposing only SHA-256 hashes for storage. */
@Injectable()
export class MembershipInvitationTokenService {
  /** Returns a random raw token for delivery and its hash for persistence. */
  create(): { raw: string; hash: string } {
    const raw = randomBytes(32).toString('base64url');
    return { raw, hash: this.hash(raw) };
  }

  /** Validates an untrusted raw token before deriving its lookup hash. */
  hashIfValid(raw: string): string | undefined {
    return TOKEN_PATTERN.test(raw) ? this.hash(raw) : undefined;
  }

  /** Derives the uniqueness key for one workspace and normalized email. */
  createActiveKey(workspaceId: string, normalizedEmail: string): string {
    return this.hash(`${workspaceId}\0${normalizedEmail}`);
  }

  /** Hashes secret or uniqueness material without retaining the source value. */
  private hash(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }
}
