import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

export type SessionToken = {
  raw: string;
  hash: string;
};

const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

@Injectable()
export class SessionTokenService {
  create(): SessionToken {
    const raw = randomBytes(32).toString('base64url');
    return { raw, hash: this.hash(raw) };
  }

  hash(raw: string): string {
    return createHash('sha256').update(raw, 'utf8').digest('hex');
  }

  hashIfValid(raw: string | undefined): string | undefined {
    return raw && SESSION_TOKEN_PATTERN.test(raw) ? this.hash(raw) : undefined;
  }
}
